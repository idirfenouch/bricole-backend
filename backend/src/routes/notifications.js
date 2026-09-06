// ─────────────────────────────────────────────────────────
// BRICOLE — Notifications Routes (/api/notifications)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/notifications ──
router.get("/", authenticate(), async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = notifications.map((n) => ({
      id: n.id,
      text: n.text,
      is_read: n.isRead,
      created_at: n.createdAt,
    }));

    res.json({ notifications: formatted });
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des notifications." });
  }
});

// ── PATCH /api/notifications/:id/read ──
router.patch("/:id/read", authenticate(), async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification introuvable." });
    }
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: "Accès refusé." });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

module.exports = router;
