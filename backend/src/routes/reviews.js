// ─────────────────────────────────────────────────────────
// BRICOLE — Reviews Routes (/api/reviews)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, reviewSchema } = require("../middleware/validate");
const { notify } = require("../utils/notify");

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/reviews ──
router.post("/", authenticate(), requireRole("particulier"), validate(reviewSchema), async (req, res) => {
  try {
    const data = req.validated;

    // Verify request exists and is completed
    const request = await prisma.request.findUnique({ where: { id: data.requestId } });
    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }
    if (request.userId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'êtes pas le propriétaire de cette demande." });
    }
    if (request.status !== "terminee") {
      return res.status(400).json({ error: "Vous ne pouvez laisser un avis que sur une demande terminée." });
    }

    // Check for existing review
    const existing = await prisma.review.findUnique({
      where: { requestId_particulierId: { requestId: data.requestId, particulierId: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ error: "Vous avez déjà laissé un avis pour cette demande." });
    }

    const review = await prisma.review.create({
      data: {
        requestId: data.requestId,
        particulierId: req.user.id,
        qualite: data.qualite,
        ponctualite: data.ponctualite,
        prix: data.prix,
        communication: data.communication,
        professionnalisme: data.professionnalisme,
        commentaire: data.commentaire || null,
      },
    });

    // Notify the professional
    const acceptedQuote = await prisma.quote.findFirst({
      where: { requestId: data.requestId, status: "accepte" },
    });
    if (acceptedQuote) {
      const avgScore = (data.qualite + data.ponctualite + data.prix + data.communication + data.professionnalisme) / 5;
      await notify(acceptedQuote.professionalId, `Nouvel avis reçu : ${avgScore.toFixed(1)}/5 ⭐`);
    }

    res.status(201).json({ review });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ error: "Erreur lors de la publication de l'avis." });
  }
});

module.exports = router;
