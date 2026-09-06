// ─────────────────────────────────────────────────────────
// BRICOLE — Users Routes (/api/users)
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { validate, updateUserSchema } = require("../middleware/validate");

const router = express.Router();
const prisma = new PrismaClient();

// ── PUT /api/users/me — Update current user's profile ──
router.put("/me", authenticate(), validate(updateUserSchema), async (req, res) => {
  try {
    const { fullName, phone, bio, metiers, ville, experienceYears } = req.validated;

    const userData = {};
    if (fullName !== undefined) userData.fullName = fullName;
    if (phone !== undefined) userData.phone = phone;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: userData,
    });

    if (req.user.role === "pro") {
      const proData = {};
      if (bio !== undefined) proData.bio = bio;
      if (metiers !== undefined) proData.metiers = JSON.stringify(metiers);
      if (ville !== undefined) proData.ville = ville;
      if (experienceYears !== undefined) proData.experienceYears = experienceYears;

      if (Object.keys(proData).length > 0) {
        await prisma.professionalProfile.upsert({
          where: { userId: req.user.id },
          update: proData,
          create: { userId: req.user.id, ...proData },
        });
      }
    }

    res.json({
      user: {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du profil." });
  }
});

module.exports = router;
