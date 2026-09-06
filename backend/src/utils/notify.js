// ─────────────────────────────────────────────────────────
// BRICOLE — Notification helper
// ─────────────────────────────────────────────────────────

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Create a notification for a user
 * @param {string} userId
 * @param {string} text
 */
async function notify(userId, text) {
  try {
    await prisma.notification.create({
      data: { userId, text },
    });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
}

module.exports = { notify };
