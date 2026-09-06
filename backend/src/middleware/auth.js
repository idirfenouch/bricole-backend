// ─────────────────────────────────────────────────────────
// BRICOLE — Auth Middleware (JWT verification)
// ─────────────────────────────────────────────────────────

const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { JWT_SECRET } = require("../config");

const prisma = new PrismaClient();

/**
 * Middleware: verifies JWT and attaches user to req.user
 * If optional=true, it will not reject unauthenticated requests
 */
function authenticate(optional = false) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (optional) { req.user = null; return next(); }
      return res.status(401).json({ error: "Token d'authentification requis." });
    }

    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { professionalProfile: true },
      });

      if (!user) {
        return res.status(401).json({ error: "Utilisateur introuvable." });
      }
      if (user.isSuspended) {
        return res.status(403).json({ error: "Votre compte a été suspendu." });
      }

      req.user = user;
      next();
    } catch (err) {
      if (optional) { req.user = null; return next(); }
      return res.status(401).json({ error: "Token invalide ou expiré." });
    }
  };
}

/**
 * Middleware: requires a specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentification requise." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès interdit pour ce rôle." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
