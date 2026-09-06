// ─────────────────────────────────────────────────────────
// BRICOLE — Validation Middleware (Zod schemas)
// ─────────────────────────────────────────────────────────

const { z } = require("zod");

// ── Schema definitions ──

const registerSchema = z.object({
  fullName: z.string().min(2, "Le nom doit contenir au moins 2 caractères."),
  email: z.string().email("Email invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  role: z.enum(["particulier", "pro"], { message: "Le rôle doit être 'particulier' ou 'pro'." }),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

const createRequestSchema = z.object({
  typeBesoin: z.string().min(1, "Le type de besoin est requis."),
  categoryId: z.number().int().positive(),
  description: z.string().min(10, "La description doit contenir au moins 10 caractères."),
  ville: z.string().min(1, "La ville est requise."),
  codePostal: z.string().optional(),
  budget: z.string().optional(),
  urgence: z.string().optional(),
  disponibilite: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

const createProposalSchema = z.object({
  message: z.string().optional(),
});

const createQuoteSchema = z.object({
  description: z.string().min(1, "La description est requise."),
  mainOeuvre: z.number().nonnegative("La main-d'œuvre doit être positive."),
  materiaux: z.number().nonnegative("Le montant matériaux doit être positif."),
  frais: z.number().nonnegative().optional().default(0),
  dureeEstimee: z.string().optional(),
  dateProposee: z.string().optional(),
});

const quoteDecisionSchema = z.object({
  decision: z.enum(["accepte", "refuse"], { message: "La décision doit être 'accepte' ou 'refuse'." }),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, "Le message ne peut pas être vide."),
});

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  qualite: z.number().int().min(1).max(5),
  ponctualite: z.number().int().min(1).max(5),
  prix: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  professionnalisme: z.number().int().min(1).max(5),
  commentaire: z.string().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  metiers: z.array(z.string()).optional(),
  ville: z.string().optional(),
  experienceYears: z.number().int().nonnegative().optional(),
});

const suspendUserSchema = z.object({
  suspended: z.boolean(),
});

const verifyProSchema = z.object({
  verified: z.boolean(),
});

// ── Validation middleware factory ──

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({ error: firstError.message });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createRequestSchema,
  createProposalSchema,
  createQuoteSchema,
  quoteDecisionSchema,
  sendMessageSchema,
  reviewSchema,
  updateUserSchema,
  suspendUserSchema,
  verifyProSchema,
};
