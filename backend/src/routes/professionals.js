// ─────────────────────────────────────────────────────────
// BRICOLE — Professionals Routes (/api/professionals)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/professionals (public search) ──
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    const professionals = await prisma.user.findMany({
      where: {
        role: "pro",
        isSuspended: false,
        professionalProfile: { isNot: null },
      },
      include: {
        professionalProfile: true,
        quotes: {
          where: { status: "accepte" },
          include: {
            request: {
              include: { reviews: true },
            },
          },
        },
      },
    });

    const result = professionals
      .map((p) => {
        const profile = p.professionalProfile || {};
        let metiers = [];
        try { metiers = JSON.parse(profile.metiers || "[]"); } catch (_) {}

        // Calculate average rating from reviews linked to accepted quotes
        let allReviews = [];
        p.quotes.forEach((q) => {
          if (q.request && q.request.reviews) {
            allReviews.push(...q.request.reviews);
          }
        });

        let avgRating = 0;
        if (allReviews.length > 0) {
          const totalScores = allReviews.reduce((sum, r) => {
            return sum + (r.qualite + r.ponctualite + r.prix + r.communication + r.professionnalisme) / 5;
          }, 0);
          avgRating = parseFloat((totalScores / allReviews.length).toFixed(1));
        }

        return {
          id: p.id,
          full_name: p.fullName,
          metiers,
          ville: profile.ville,
          experience_years: profile.experienceYears,
          verified: profile.verified,
          average_rating: avgRating,
          review_count: allReviews.length,
        };
      })
      .filter((p) => {
        if (!category || category === "Tous les métiers") return true;
        return p.metiers.includes(category);
      });

    res.json({ professionals: result });
  } catch (err) {
    console.error("Search professionals error:", err);
    res.status(500).json({ error: "Erreur lors de la recherche des professionnels." });
  }
});

// ── GET /api/professionals/:id (public profile detail) ──
router.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        professionalProfile: {
          include: { portfolio: true },
        },
        quotes: {
          where: { status: "accepte" },
          include: {
            request: {
              include: {
                reviews: {
                  include: { particulier: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.role !== "pro" || user.isSuspended) {
      return res.status(404).json({ error: "Professionnel introuvable." });
    }

    const profile = user.professionalProfile || {};
    let metiers = [];
    try { metiers = JSON.parse(profile.metiers || "[]"); } catch (_) {}

    // Gather reviews
    let allReviews = [];
    user.quotes.forEach((q) => {
      if (q.request && q.request.reviews) {
        allReviews.push(...q.request.reviews);
      }
    });

    let avgRating = 0;
    if (allReviews.length > 0) {
      const totalScores = allReviews.reduce((sum, r) => {
        return sum + (r.qualite + r.ponctualite + r.prix + r.communication + r.professionnalisme) / 5;
      }, 0);
      avgRating = parseFloat((totalScores / allReviews.length).toFixed(1));
    }

    const formattedReviews = allReviews.map((r) => ({
      id: r.id,
      particulier_name: r.particulier?.fullName || "Particulier",
      qualite: r.qualite,
      ponctualite: r.ponctualite,
      prix: r.prix,
      communication: r.communication,
      professionnalisme: r.professionnalisme,
      commentaire: r.commentaire,
      created_at: r.createdAt,
    }));

    const portfolio = (profile.portfolio || []).map((item) => ({
      id: item.id,
      image_url: item.imageUrl,
      description: item.description,
    }));

    res.json({
      professional: {
        id: user.id,
        full_name: user.fullName,
        bio: profile.bio,
        metiers,
        ville: profile.ville,
        experience_years: profile.experienceYears,
        verified: profile.verified,
        average_rating: avgRating,
        review_count: allReviews.length,
      },
      portfolio,
      reviews: formattedReviews,
    });
  } catch (err) {
    console.error("Professional detail error:", err);
    res.status(500).json({ error: "Erreur lors du chargement du profil professionnel." });
  }
});

module.exports = router;
