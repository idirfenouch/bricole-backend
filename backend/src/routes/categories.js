// ─────────────────────────────────────────────────────────
// BRICOLE — Categories Routes (/api/categories)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/categories (public) ──
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ categories });
  } catch (err) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des catégories." });
  }
});

module.exports = router;
