import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { analyzeMealPhoto } from '../services/ai.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import type { Goal } from '../types/index.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /meals - client uploads a meal photo
router.post('/', requireAuth, requireRole('client'), upload.single('photo'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No photo uploaded' });
    return;
  }

  const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']).safeParse(req.body.meal_type);
  if (!mealType.success) {
    res.status(400).json({ error: 'meal_type must be one of: breakfast, lunch, dinner, snack' });
    return;
  }

  // Fetch client profile for context
  const { data: profile } = await supabase
    .from('profiles')
    .select('goal, age, weight_kg')
    .eq('user_id', req.userId!)
    .single();

  // Upload photo to Supabase Storage
  const fileExt = req.file.mimetype.split('/')[1];
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

  // Create meal record first (pending AI analysis)
  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({
      client_id: req.userId!,
      photo_url: publicUrl,
      meal_type: mealType.data,
      eaten_at: new Date().toISOString(),
      feedback_status: 'pending_ai',
    })
    .select()
    .single();

  if (mealError || !meal) {
    res.status(500).json({ error: 'Failed to create meal record' });
    return;
  }

  // Analyze with Claude Vision (async — update meal after)
  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const { analysis, feedbackDraft } = await analyzeMealPhoto(
      imageBase64,
      req.file.mimetype,
      (profile?.goal as Goal) ?? 'maintain',
      profile?.age,
      profile?.weight_kg
    );

    await supabase
      .from('meals')
      .update({
        ai_analysis: analysis,
        ai_feedback_draft: feedbackDraft,
        feedback_status: 'draft',
      })
      .eq('id', meal.id);

    res.status(201).json({ ...meal, ai_analysis: analysis, ai_feedback_draft: feedbackDraft, feedback_status: 'draft' });
  } catch (aiError) {
    // Return meal even if AI fails — nutritionist can still give manual feedback
    console.error('AI analysis failed:', aiError);
    res.status(201).json({ ...meal, ai_error: 'AI analysis unavailable, manual review required' });
  }
});

// GET /meals - client sees their meals
router.get('/', requireAuth, requireRole('client'), async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('client_id', req.userId!)
    .order('eaten_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: 'Failed to fetch meals' });
    return;
  }
  res.json(data);
});

// GET /meals/:id - get single meal
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { data: meal, error } = await supabase
    .from('meals')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !meal) {
    res.status(404).json({ error: 'Meal not found' });
    return;
  }

  // Client can only see their own meals; nutritionist can see any client's meal
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

const feedbackSchema = z.object({
  feedback: z.string().min(1).max(2000),
});

// PUT /meals/:id/feedback - nutritionist sends/edits feedback
router.put('/:id/feedback', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Verify meal belongs to one of this nutritionist's clients
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
    .update({
      nutritionist_feedback: parsed.data.feedback,
      feedback_status: 'sent',
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update feedback' });
    return;
  }
  res.json(data);
});

// GET /meals/daily-summary/:clientId - nutritionist requests daily summary for a client
router.get('/daily-summary/:clientId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

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
    .gte('eaten_at', `${date}T00:00:00`)
    .lte('eaten_at', `${date}T23:59:59`);

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
});

export default router;
