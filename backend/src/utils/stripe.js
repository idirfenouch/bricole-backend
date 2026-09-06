// ─────────────────────────────────────────────────────────
// BRICOLE — Stripe helper
// ─────────────────────────────────────────────────────────

const { STRIPE_SECRET_KEY } = require("../config");

let stripe = null;

function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== "sk_test_REPLACE_ME") {
    stripe = require("stripe")(STRIPE_SECRET_KEY);
  }
  return stripe;
}

function isStripeConfigured() {
  return !!(STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== "sk_test_REPLACE_ME");
}

module.exports = { getStripe, isStripeConfigured };
