// ─────────────────────────────────────────────────────────
// BRICOLE — Conversations & Messages Routes
// ─────────────────────────────────────────────────────────

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { validate, sendMessageSchema } = require("../middleware/validate");

const router = express.Router();
const prisma = new PrismaClient();

// ── GET /api/conversations — My conversations ──
router.get("/", authenticate(), async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { particulierId: userId },
          { professionalId: userId },
        ],
      },
      include: {
        particulier: true,
        professional: true,
        request: { include: { category: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = conversations.map((c) => {
      const isParticulier = c.particulierId === userId;
      const otherParty = isParticulier ? c.professional : c.particulier;
      return {
        id: c.id,
        request_id: c.requestId,
        professional_id: c.professionalId,
        other_party_name: otherParty.fullName,
        type_besoin: c.request.typeBesoin,
        category_name: c.request.category.name,
        last_message: c.messages[0]?.content || null,
        created_at: c.createdAt,
      };
    });

    res.json({ conversations: formatted });
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des conversations." });
  }
});

// ── POST /api/conversations/open — Open or create a conversation ──
router.post("/open", authenticate(), async (req, res) => {
  try {
    const { requestId, professionalId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "ID de demande requis." });
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { category: true, user: true },
    });

    if (!request) {
      return res.status(404).json({ error: "Demande introuvable." });
    }

    let proId = professionalId;
    let partId = request.userId;

    if (!proId) {
      if (req.user.role === "pro") {
        proId = req.user.id;
      } else {
        return res.status(400).json({ error: "ID de professionnel requis." });
      }
    }

    let conversation = await prisma.conversation.findUnique({
      where: {
        requestId_professionalId: {
          requestId,
          professionalId: proId,
        },
      },
      include: {
        particulier: true,
        professional: true,
        request: { include: { category: true } },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          requestId,
          particulierId: partId,
          professionalId: proId,
        },
        include: {
          particulier: true,
          professional: true,
          request: { include: { category: true } },
        },
      });
    }

    const isParticulier = conversation.particulierId === req.user.id;
    const otherParty = isParticulier ? conversation.professional : conversation.particulier;

    res.json({
      conversation: {
        id: conversation.id,
        request_id: conversation.requestId,
        professional_id: conversation.professionalId,
        other_party_name: otherParty?.fullName || "Utilisateur",
        type_besoin: conversation.request.typeBesoin,
        category_name: conversation.request.category?.name,
        created_at: conversation.createdAt,
      },
    });
  } catch (err) {
    console.error("Open conversation error:", err);
    res.status(500).json({ error: "Erreur lors de l'ouverture de la conversation." });
  }
});

// ── GET /api/conversations/:id — Get conversation details ──
router.get("/:id", authenticate(), async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        particulier: true,
        professional: true,
        request: { include: { category: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    if (conversation.particulierId !== req.user.id && conversation.professionalId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'avez pas accès à cette conversation." });
    }

    const isParticulier = conversation.particulierId === req.user.id;
    const otherParty = isParticulier ? conversation.professional : conversation.particulier;

    res.json({
      conversation: {
        id: conversation.id,
        request_id: conversation.requestId,
        professional_id: conversation.professionalId,
        other_party_name: otherParty?.fullName || "Utilisateur",
        type_besoin: conversation.request.typeBesoin,
        category_name: conversation.request.category?.name,
        created_at: conversation.createdAt,
      },
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    res.status(500).json({ error: "Erreur lors du chargement de la conversation." });
  }
});

// ── GET /api/conversations/:id/messages ──
router.get("/:id/messages", authenticate(), async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    // Verify user is part of this conversation
    if (conversation.particulierId !== req.user.id && conversation.professionalId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'avez pas accès à cette conversation." });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      sender_id: m.senderId,
      sender_name: m.sender.fullName,
      content: m.content,
      created_at: m.createdAt,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error("Messages error:", err);
    res.status(500).json({ error: "Erreur lors du chargement des messages." });
  }
});

// ── POST /api/conversations/:id/messages ──
router.post("/:id/messages", authenticate(), validate(sendMessageSchema), async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    if (conversation.particulierId !== req.user.id && conversation.professionalId !== req.user.id) {
      return res.status(403).json({ error: "Vous n'avez pas accès à cette conversation." });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        content: req.validated.content,
      },
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Erreur lors de l'envoi du message." });
  }
});

module.exports = router;
