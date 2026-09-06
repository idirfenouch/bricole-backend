// ─────────────────────────────────────────────────────────
// BRICOLE — Appointments Routes (/api/appointments)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/appointments — My appointments ──
router.get("/", authenticate(), async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: req.user.id },
      orderBy: { scheduledAt: "asc" },
    });

    const formatted = appointments.map((a) => ({
      id: a.id,
      type: a.type,
      other_party_name: a.otherPartyName,
      scheduled_at: a.scheduledAt,
      created_at: a.createdAt,
    }));

    res.json({ appointments: formatted });
  } catch (err) {
    console.error("Appointments error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des rendez-vous." });
  }
});

module.exports = router;
