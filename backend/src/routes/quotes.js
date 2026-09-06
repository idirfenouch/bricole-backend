// ─────────────────────────────────────────────────────────
// BRICOLE — Quotes Routes
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, createQuoteSchema, quoteDecisionSchema } = require("../middleware/validate");
const { notify } = require("../utils/notify");

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// ── GET /api/requests/:id/quotes ──
router.get("/request/:id", authenticate(), async (req, res) => {
  try {
    const quotes = await prisma.quote.findMany({
      where: { requestId: req.params.id },
      include: { professional: true },
      orderBy: { createdAt: "desc" },
    });

    const formatted = quotes.map((q) => ({
      id: q.id,
      professional_id: q.professionalId,
      professional_name: q.professional.fullName,
      description: q.description,
      main_oeuvre: q.mainOeuvre,
      materiaux: q.materiaux,
      frais: q.frais,
      total: q.total,
      duree_estimee: q.dureeEstimee,
      date_proposee: q.dateProposee,
      status: q.status,
      created_at: q.createdAt,
    }));

    res.json({ quotes: formatted });
  } catch (err) {
    console.error("Quotes error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des devis." });
  }
});

// ── POST /api/requests/:id/quotes — Submit a quote (pro) ──
router.post("/request/:id", authenticate(), requireRole("pro"), validate(createQuoteSchema), async (req, res) => {
  try {
    const requestId = req.params.id;
    const data = req.validated;

    // Check request exists
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }

    const total = data.mainOeuvre + data.materiaux + (data.frais || 0);

    const quote = await prisma.quote.create({
      data: {
        requestId,
        professionalId: req.user.id,
        description: data.description,
        mainOeuvre: data.mainOeuvre,
        materiaux: data.materiaux,
        frais: data.frais || 0,
        total,
        dureeEstimee: data.dureeEstimee || null,
        dateProposee: data.dateProposee || null,
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "devis_recus" },
    });

    // Ensure a conversation exists
    const existingConv = await prisma.conversation.findUnique({
      where: { requestId_professionalId: { requestId, professionalId: req.user.id } },
    });
    if (!existingConv) {
      await prisma.conversation.create({
        data: {
          requestId,
          particulierId: request.userId,
          professionalId: req.user.id,
        },
      });
    }

    // Notify particulier
    await notify(request.userId, `Nouveau devis de ${req.user.fullName} : ${total.toLocaleString("fr-FR")} DA`);

    res.status(201).json({ quote });
  } catch (err) {
    console.error("Create quote error:", err);
    res.status(500).json({ error: "Erreur lors de la soumission du devis." });
  }
});

// ── PATCH /api/quotes/:id/decision — Accept or reject a quote ──
router.patch("/:id/decision", authenticate(), validate(quoteDecisionSchema), async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { request: true },
    });

    if (!quote) {
      return res.status(404).json({ error: "Devis introuvable." });
    }
    if (quote.request.userId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'êtes pas le propriétaire de cette demande." });
    }
    if (quote.status !== "en_attente") {
      return res.status(400).json({ error: "Ce devis a déjà été traité." });
    }

    const { decision } = req.validated;

    // Update quote
    await prisma.quote.update({
      where: { id: req.params.id },
      data: { status: decision },
    });

    // If accepted, update request status and reject other quotes
    if (decision === "accepte") {
      await prisma.request.update({
        where: { id: quote.requestId },
        data: { status: "pro_selectionne" },
      });

      // Reject all other pending quotes for this request
      await prisma.quote.updateMany({
        where: {
          requestId: quote.requestId,
          id: { not: req.params.id },
          status: "en_attente",
        },
        data: { status: "refuse" },
      });

      // Create an appointment
      await prisma.appointment.create({
        data: {
          userId: req.user.id,
          type: "Intervention",
          otherPartyName: (await prisma.user.findUnique({ where: { id: quote.professionalId } })).fullName,
          scheduledAt: quote.dateProposee ? new Date(quote.dateProposee) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Also create appointment for the pro
      await prisma.appointment.create({
        data: {
          userId: quote.professionalId,
          type: "Intervention",
          otherPartyName: req.user.fullName,
          scheduledAt: quote.dateProposee ? new Date(quote.dateProposee) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await notify(quote.professionalId, `Votre devis de ${quote.total.toLocaleString("fr-FR")} DA a été accepté ! 🎉`);
    } else {
      await notify(quote.professionalId, `Votre devis a été refusé par le particulier.`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Quote decision error:", err);
    res.status(500).json({ error: "Erreur lors du traitement du devis." });
  }
});

module.exports = router;
