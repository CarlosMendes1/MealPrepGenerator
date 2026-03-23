import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { analyzeMealPhoto } from '../services/ai.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import type { Goal } from '../types/index.js';

const router = Router();

// ── Multer: memory storage, 10 MB cap, image-only MIME whitelist ──────────
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, HEIC) are allowed'));
    }
  },
});

// ── Schemas ───────────────────────────────────────────────────────────────
const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

const feedbackSchema = z.object({
  feedback: z.string().min(1).max(2000),
});

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), 'Invalid date');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Columns to expose ─────────────────────────────────────────────────────
const MEAL_COLUMNS = 'id, client_id, photo_url, meal_type, eaten_at, client_notes, feedback_status, ai_analysis, ai_feedback_draft, nutritionist_feedback, created_at';

// ── POST /meals — client uploads a meal photo ─────────────────────────────
router.post(
  '/',
  requireAuth,
  requireRole('client'),
  upload.single('photo'),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No photo uploaded' });
      return;
    }

    const mealType = mealTypeSchema.safeParse(req.body.meal_type);
    if (!mealType.success) {
      res.status(400).json({ error: 'meal_type must be one of: breakfast, lunch, dinner, snack' });
      return;
    }

    const clientNotes = typeof req.body.client_notes === 'string'
      ? req.body.client_notes.trim().slice(0, 500) || null
      : null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('goal, age, weight_kg')
      .eq('user_id', req.userId!)
      .single();

    // Safe extension from whitelist — never trust user-provided extension
    const fileExt = MIME_TO_EXT[req.file.mimetype] ?? 'jpg';
    const fileName = `${req.userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('meal-photos')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      res.status(500).json({ error: 'Failed to upload photo' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('meal-photos')
      .getPublicUrl(fileName);

    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .insert({
        client_id: req.userId!,
        photo_url: publicUrl,
        meal_type: mealType.data,
        eaten_at: new Date().toISOString(),
        client_notes: clientNotes,
        feedback_status: 'pending_ai',
      })
      .select(MEAL_COLUMNS)
      .single();

    if (mealError || !meal) {
      res.status(500).json({ error: 'Failed to create meal record' });
      return;
    }

    try {
      const imageBase64 = req.file.buffer.toString('base64');
      const { analysis, feedbackDraft } = await analyzeMealPhoto(
        imageBase64,
        req.file.mimetype,
        (profile?.goal as Goal) ?? 'maintain',
        profile?.age,
        profile?.weight_kg,
        clientNotes
      );

      await supabase
        .from('meals')
        .update({ ai_analysis: analysis, ai_feedback_draft: feedbackDraft, feedback_status: 'draft' })
        .eq('id', meal.id);

      res.status(201).json({ ...meal, ai_analysis: analysis, ai_feedback_draft: feedbackDraft, feedback_status: 'draft' });
    } catch (aiError) {
      console.error('[AI] analyzeMealPhoto failed:', aiError instanceof Error ? aiError.message : aiError);
      res.status(201).json({ ...meal, ai_error: 'AI analysis unavailable. Manual review required.' });
    }
  }
);

// ── GET /meals — client's own meals (paginated) ───────────────────────────
router.get('/', requireAuth, requireRole('client'), async (req: AuthRequest, res) => {
  const pagination = paginationSchema.safeParse(req.query);
  if (!pagination.success) {
    res.status(400).json({ error: pagination.error.flatten() });
    return;
  }
  const { limit, offset } = pagination.data;

  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_COLUMNS)
    .eq('client_id', req.userId!)
    .order('eaten_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch meals' });
    return;
  }
  res.json(data);
});

// ── GET /meals/daily-summary/:clientId — nutritionist requests daily summary
// Must be declared BEFORE /:id to avoid shadowing.
router.get(
  '/daily-summary/:clientId',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res) => {
    const dateResult = dateSchema.safeParse(
      req.query.date ?? new Date().toISOString().split('T')[0]
    );
    if (!dateResult.success) {
      res.status(400).json({ error: dateResult.error.flatten() });
      return;
    }
    const date = dateResult.data;
    const { clientId } = req.params;

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('nutritionist_id, full_name, goal, age, weight_kg')
      .eq('user_id', clientId)
      .single();

    if (!clientProfile || clientProfile.nutritionist_id !== req.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { data: meals } = await supabase
      .from('meals')
      .select('meal_type, ai_analysis')
      .eq('client_id', clientId)
      .gte('eaten_at', `${date}T00:00:00.000Z`)
      .lte('eaten_at', `${date}T23:59:59.999Z`);

    if (!meals || meals.length === 0) {
      res.json({ summary: 'Nenhuma refeição registada para este dia.' });
      return;
    }

    const { generateDailySummary } = await import('../services/ai.js');
    const summary = await generateDailySummary(
      meals as any,
      (clientProfile.goal as Goal) ?? 'maintain',
      clientProfile.full_name
    );

    res.json({ summary, date, meals_count: meals.length });
  }
);

// ── GET /meals/:id — single meal ──────────────────────────────────────────
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { data: meal, error } = await supabase
    .from('meals')
    .select(MEAL_COLUMNS)
    .eq('id', req.params.id)
    .single();

  if (error || !meal) {
    res.status(404).json({ error: 'Meal not found' });
    return;
  }

  if (req.userRole === 'client' && meal.client_id !== req.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (req.userRole === 'nutritionist') {
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('nutritionist_id')
      .eq('user_id', meal.client_id)
      .single();

    if (clientProfile?.nutritionist_id !== req.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  res.json(meal);
});

// ── PUT /meals/:id/feedback — nutritionist sends feedback ─────────────────
router.put('/:id/feedback', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { data: meal } = await supabase
    .from('meals')
    .select('client_id')
    .eq('id', req.params.id)
    .single();

  if (!meal) {
    res.status(404).json({ error: 'Meal not found' });
    return;
  }

  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('nutritionist_id')
    .eq('user_id', meal.client_id)
    .single();

  if (clientProfile?.nutritionist_id !== req.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { data, error } = await supabase
    .from('meals')
    .update({ nutritionist_feedback: parsed.data.feedback, feedback_status: 'sent' })
    .eq('id', req.params.id)
    .select(MEAL_COLUMNS)
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update feedback' });
    return;
  }
  res.json(data);
});

export default router;
