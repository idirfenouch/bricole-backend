// ─────────────────────────────────────────────────────────
// BRICOLE — Payments Routes (/api/payments)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { getStripe, isStripeConfigured } = require("../utils/stripe");
const { FRONTEND_URL, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET } = require("../config");
const { notify } = require("../utils/notify");

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/payments/create-checkout — Pro subscription checkout ──
router.post("/create-checkout", authenticate(), requireRole("pro"), async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      // Demo / simulated mode if Stripe keys are not configured
      await prisma.professionalProfile.update({
        where: { userId: req.user.id },
        data: { subscriptionStatus: "active" },
      });
      await notify(req.user.id, "Votre abonnement professionnel a été activé avec succès (Mode Démo) !");
      return res.json({
        demo: true,
        message: "Stripe non configuré : l'abonnement pro a été activé en mode démonstration.",
        url: `${FRONTEND_URL}/#dashboard`,
      });
    }

    const stripe = getStripe();
    let customerId = req.user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: req.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "dzd",
            product_data: {
              name: "Abonnement BRICOLE Pro",
              description: "Accès illimité aux demandes de travaux et mise en relation directe",
            },
            unit_amount: 350000, // 3500.00 DZD
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/#dashboard?payment=success`,
      cancel_url: `${FRONTEND_URL}/#dashboard?payment=cancelled`,
      metadata: { userId: req.user.id },
    });

    // Save pending payment record
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        stripeSessionId: session.id,
        amount: 3500,
        currency: "dzd",
        status: "pending",
        description: "Abonnement Pro Mensuel",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Create checkout error:", err);
    res.status(500).json({ error: "Erreur lors de la création de la session de paiement." });
  }
});

// ── GET /api/payments/status — Check pro subscription status ──
router.get("/status", authenticate(), requireRole("pro"), async (req, res) => {
  try {
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: req.user.id },
    });

    res.json({
      subscriptionStatus: profile?.subscriptionStatus || "inactive",
    });
  } catch (err) {
    console.error("Payment status error:", err);
    res.status(500).json({ error: "Erreur lors de la vérification du statut." });
  }
});

// ── POST /api/payments/webhook — Stripe webhook ──
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(200).json({ received: true, note: "Stripe not active" });
  }

  const sig = req.headers["stripe-signature"];
  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;

      if (userId) {
        await prisma.professionalProfile.update({
          where: { userId },
          data: { subscriptionStatus: "active" },
        });

        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: { status: "completed" },
        });

        await notify(userId, "Votre paiement a été validé ! Votre abonnement Pro est maintenant actif.");
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer },
      });

      if (user) {
        await prisma.professionalProfile.update({
          where: { userId: user.id },
          data: { subscriptionStatus: "cancelled" },
        });

        await notify(user.id, "Votre abonnement Pro a expiré ou a été résilié.");
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Erreur lors du traitement du webhook." });
  }
});

module.exports = router;
