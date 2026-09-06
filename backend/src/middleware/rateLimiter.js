// ─────────────────────────────────────────────────────────
// BRICOLE — Rate Limiter Middleware
// ─────────────────────────────────────────────────────────

const rateLimit = require("express-rate-limit");

/** Global limiter: 100 requests per 15 minutes per IP */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Veuillez réessayer dans quelques minutes." },
});

/** Auth limiter: 10 attempts per 15 minutes per IP (login / register) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

module.exports = { globalLimiter, authLimiter };
