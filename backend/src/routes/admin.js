// ─────────────────────────────────────────────────────────
// BRICOLE — Admin Routes (/api/admin)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, suspendUserSchema, verifyProSchema } = require("../middleware/validate");
const { notify } = require("../utils/notify");

const router = express.Router();
const prisma = new PrismaClient();

// Protect all admin routes
router.use(authenticate(), requireRole("admin"));

// ── GET /api/admin/stats ──
router.get("/stats", async (req, res) => {
  try {
    const particuliers = await prisma.user.count({ where: { role: "particulier" } });
    const professionnels = await prisma.user.count({ where: { role: "pro" } });
    const demandesPubliees = await prisma.request.count();
    const demandesTerminees = await prisma.request.count({ where: { status: "terminee" } });
    const nombreDevis = await prisma.quote.count();

    const acceptedQuotes = await prisma.quote.findMany({
      where: { status: "accepte" },
      select: { total: true },
    });
    const chiffreAffaires = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);

    res.json({
      particuliers,
      professionnels,
      demandesPubliees,
      demandesTerminees,
      nombreDevis,
      chiffreAffaires: `${chiffreAffaires.toLocaleString("fr-FR")} DA`,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Erreur lors du calcul des statistiques." });
  }
});

// ── GET /api/admin/users ──
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { professionalProfile: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = users.map((u) => ({
      id: u.id,
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      phone: u.phone,
      is_suspended: u.isSuspended,
      verified: u.professionalProfile?.verified || false,
      created_at: u.createdAt,
    }));

    res.json({ users: formatted });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs." });
  }
});

// ── PATCH /api/admin/users/:id/suspend ──
router.patch("/users/:id/suspend", validate(suspendUserSchema), async (req, res) => {
  try {
    const { suspended } = req.validated;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isSuspended: suspended },
    });

    res.json({ success: true, user: { id: user.id, is_suspended: user.isSuspended } });
  } catch (err) {
    console.error("Suspend user error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut." });
  }
});

// ── PATCH /api/admin/professionals/:id/verify ──
router.patch("/professionals/:id/verify", validate(verifyProSchema), async (req, res) => {
  try {
    const { verified } = req.validated;
    const profile = await prisma.professionalProfile.update({
      where: { userId: req.params.id },
      data: { verified },
    });

    if (verified) {
      await notify(req.params.id, "Félicitations ! Votre profil professionnel a été vérifié par notre équipe.");
    }

    res.json({ success: true, profile: { verified: profile.verified } });
  } catch (err) {
    console.error("Verify pro error:", err);
    res.status(500).json({ error: "Erreur lors de la vérification du professionnel." });
  }
});

module.exports = router;
