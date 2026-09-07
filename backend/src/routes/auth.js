// ─────────────────────────────────────────────────────────
// BRICOLE — Auth Routes (/api/auth)
// ─────────────────────────────────────────────────────────

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require("../config");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { validate, registerSchema, loginSchema } = require("../middleware/validate");

const router = express.Router();
const prisma = new PrismaClient();

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  const out = {
    id: safe.id,
    full_name: safe.fullName,
    email: safe.email,
    role: safe.role,
    phone: safe.phone,
    is_suspended: safe.isSuspended,
    created_at: safe.createdAt,
  };

  if (safe.role === "pro" && safe.professionalProfile) {
    let metiers = [];
    try { metiers = JSON.parse(safe.professionalProfile.metiers || "[]"); } catch (_) {}
    out.bio = safe.professionalProfile.bio || "";
    out.metiers = metiers;
    out.ville = safe.professionalProfile.ville || "";
    out.experience_years = safe.professionalProfile.experienceYears || null;
    out.verified = safe.professionalProfile.verified || false;
  }

  return out;
}

// ── POST /api/auth/register ──
router.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.validated;

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Un compte avec cet email existe déjà." });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash, role, phone },
    });

    // If pro, create an empty professional profile
    if (role === "pro") {
      await prisma.professionalProfile.create({
        data: { userId: user.id },
      });
    }

    const token = generateToken(user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Erreur interne lors de l'inscription." });
  }
});

// ── POST /api/auth/login ──
router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    if (user.isSuspended) {
      return res.status(403).json({ error: "Votre compte a été suspendu." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const token = generateToken(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erreur interne lors de la connexion." });
  }
});

// ── GET /api/auth/me ──
router.get("/me", authenticate(), async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

module.exports = router;