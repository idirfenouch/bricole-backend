require("dotenv").config();

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET || "fallback-secret-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5500",

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || "",

  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@bricole.dz",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin1234!",

  BCRYPT_ROUNDS: 12,
};
