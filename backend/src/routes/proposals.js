// ─────────────────────────────────────────────────────────
// BRICOLE — Proposals Routes (/api/requests/:id/proposals)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, createProposalSchema } = require("../middleware/validate");
const { notify } = require("../utils/notify");

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// ── GET /api/requests/:id/proposals ──
router.get("/", authenticate(), async (req, res) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { requestId: req.params.id },
      include: {
        professional: {
          include: { professionalProfile: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = proposals.map((p) => ({
      id: p.id,
      professional_id: p.professionalId,
      professional_name: p.professional.fullName,
      verified: p.professional.professionalProfile?.verified || false,
      message: p.message,
      created_at: p.createdAt,
    }));

    res.json({ proposals: formatted });
  } catch (err) {
    console.error("Proposals error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des propositions." });
  }
});

// ── POST /api/requests/:id/proposals — Express interest (pro) ──
router.post("/", authenticate(), requireRole("pro"), validate(createProposalSchema), async (req, res) => {
  try {
    const requestId = req.params.id;

    // Check request exists
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }

    // Check if already proposed
    const existing = await prisma.proposal.findUnique({
      where: { requestId_professionalId: { requestId, professionalId: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ error: "Vous avez déjà exprimé votre intérêt pour cette demande." });
    }

    // Create proposal
    const proposal = await prisma.proposal.create({
      data: {
        requestId,
        professionalId: req.user.id,
        message: req.validated.message || "Je suis disponible pour ce chantier.",
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "interesses" },
    });

    // Create conversation between particulier and pro
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
    await notify(request.userId, `Un professionnel (${req.user.fullName}) s'intéresse à votre demande !`);

    res.status(201).json({ proposal });
  } catch (err) {
    console.error("Create proposal error:", err);
    res.status(500).json({ error: "Erreur lors de l'expression d'intérêt." });
  }
});

module.exports = router;
