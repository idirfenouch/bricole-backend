// ─────────────────────────────────────────────────────────
// BRICOLE — Requests Routes (/api/requests)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, createRequestSchema } = require("../middleware/validate");
const { notify } = require("../utils/notify");

const router = express.Router();
const prisma = new PrismaClient();

// ── POST /api/requests — Create a new request (particulier) ──
router.post("/", authenticate(), requireRole("particulier"), validate(createRequestSchema), async (req, res) => {
  try {
    const data = req.validated;

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return res.status(400).json({ error: "Catégorie introuvable." });
    }

    const request = await prisma.request.create({
      data: {
        userId: req.user.id,
        categoryId: data.categoryId,
        typeBesoin: data.typeBesoin,
        description: data.description,
        ville: data.ville,
        codePostal: data.codePostal || "",
        budget: data.budget || "",
        urgence: data.urgence || "",
        disponibilite: data.disponibilite || "",
        photoUrls: JSON.stringify(data.photoUrls || []),
        status: "publiee",
      },
    });

    res.status(201).json({ request });
  } catch (err) {
    console.error("Create request error:", err);
    res.status(500).json({ error: "Erreur lors de la création de la demande." });
  }
});

// ── GET /api/requests/mine — My requests (particulier) ──
router.get("/mine", authenticate(), requireRole("particulier"), async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: { userId: req.user.id },
      include: {
        category: true,
        _count: { select: { proposals: true, quotes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = requests.map((r) => ({
      id: r.id,
      type_besoin: r.typeBesoin,
      category_name: r.category.name,
      description: r.description,
      ville: r.ville,
      budget: r.budget,
      urgence: r.urgence,
      status: r.status,
      interesses: r._count.proposals,
      devis: r._count.quotes,
      created_at: r.createdAt,
    }));

    res.json({ requests: formatted });
  } catch (err) {
    console.error("My requests error:", err);
    res.status(500).json({ error: "Erreur lors du chargement de vos demandes." });
  }
});

// ── GET /api/requests/feed — Feed for professionals ──
router.get("/feed", authenticate(), requireRole("pro"), async (req, res) => {
  try {
    const profile = req.user.professionalProfile;
    let metiers = [];
    if (profile && profile.metiers) {
      try { metiers = JSON.parse(profile.metiers); } catch (_) {}
    }

    // Find categories matching the professional's métiers
    let categoryFilter = {};
    if (metiers.length > 0) {
      const matchingCategories = await prisma.category.findMany({
        where: { name: { in: metiers } },
      });
      if (matchingCategories.length > 0) {
        categoryFilter = { categoryId: { in: matchingCategories.map((c) => c.id) } };
      }
    }

    const requests = await prisma.request.findMany({
      where: {
        status: { in: ["publiee", "interesses"] },
        ...categoryFilter,
        // Don't show requests the pro already proposed on
        NOT: { proposals: { some: { professionalId: req.user.id } } },
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = requests.map((r) => ({
      id: r.id,
      type_besoin: r.typeBesoin,
      category_name: r.category.name,
      description: r.description,
      ville: r.ville,
      budget: r.budget,
      urgence: r.urgence,
      status: r.status,
      created_at: r.createdAt,
    }));

    res.json({ requests: formatted });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Erreur lors du chargement du feed." });
  }
});

// ── GET /api/requests/:id — Request detail ──
router.get("/:id", authenticate(), async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: { category: true, user: true },
    });

    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }

    res.json({
      request: {
        id: request.id,
        type_besoin: request.typeBesoin,
        category_name: request.category.name,
        description: request.description,
        ville: request.ville,
        code_postal: request.codePostal,
        budget: request.budget,
        urgence: request.urgence,
        disponibilite: request.disponibilite,
        status: request.status,
        created_at: request.createdAt,
      },
    });
  } catch (err) {
    console.error("Request detail error:", err);
    res.status(500).json({ error: "Erreur lors du chargement de la demande." });
  }
});

// ── PATCH /api/requests/:id/complete — Mark request as complete ──
router.patch("/:id/complete", authenticate(), async (req, res) => {
  try {
    const request = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }
    if (request.userId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'êtes pas le propriétaire de cette demande." });
    }
    if (!["pro_selectionne", "en_cours"].includes(request.status)) {
      return res.status(400).json({ error: "Cette demande ne peut pas être marquée comme terminée." });
    }

    const updated = await prisma.request.update({
      where: { id: req.params.id },
      data: { status: "terminee" },
    });

    // Notify the accepted professional
    const acceptedQuote = await prisma.quote.findFirst({
      where: { requestId: request.id, status: "accepte" },
    });
    if (acceptedQuote) {
      await notify(acceptedQuote.professionalId, `Le particulier a marqué la demande comme terminée. Merci pour votre travail !`);
    }

    res.json({ request: updated });
  } catch (err) {
    console.error("Complete request error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

module.exports = router;
