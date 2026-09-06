// ─────────────────────────────────────────────────────────
// BRICOLE — Main Express Server
// ─────────────────────────────────────────────────────────

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { PORT, NODE_ENV, FRONTEND_URL } = require("./config");
const { globalLimiter } = require("./middleware/rateLimiter");

// Route imports
const authRoutes = require("./routes/auth");
const categoriesRoutes = require("./routes/categories");
const requestsRoutes = require("./routes/requests");
const proposalsRoutes = require("./routes/proposals");
const quotesRoutes = require("./routes/quotes");
const conversationsRoutes = require("./routes/conversations");
const reviewsRoutes = require("./routes/reviews");
const appointmentsRoutes = require("./routes/appointments");
const notificationsRoutes = require("./routes/notifications");
const usersRoutes = require("./routes/users");
const professionalsRoutes = require("./routes/professionals");
const paymentsRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");

const app = express();

// ── Security Middleware ──
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, file:// or local testing)
      if (!origin) return callback(null, true);
      // In dev, allow localhost and any origin
      return callback(null, true);
    },
    credentials: true,
  })
);

// Global rate limiting
app.use("/api/", globalLimiter);

// ── Payments Webhook route (must be before express.json() for raw body) ──
app.use("/api/payments/webhook", paymentsRoutes);

// ── Body parsers ──
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/requests/:id/proposals", proposalsRoutes);
app.use("/api/requests/:id/quotes", (req, res, next) => {
  // forward request id to quotes router
  req.url = `/request/${req.params.id}${req.url === "/" ? "" : req.url}`;
  quotesRoutes(req, res, next);
});
app.use("/api/quotes", quotesRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/professionals", professionalsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", adminRoutes);

// ── Health Check ──
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BRICOLE API",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ──
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} introuvable.` });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    error: NODE_ENV === "production" ? "Une erreur interne est survenue." : err.message,
  });
});

// ── Start Server ──
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 BRICOLE API Server is running!                         ║
║  📡 URL: http://localhost:${PORT}                            ║
║  🩺 Health check: http://localhost:${PORT}/api/health        ║
║  🔒 Environment: ${NODE_ENV.padEnd(26)}        ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
