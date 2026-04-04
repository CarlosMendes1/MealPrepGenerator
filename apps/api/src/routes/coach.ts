import { Router, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { buildCoachContext } from '../lib/coachContext.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Stub assistant turn anchoring the volatile context in the messages array.
// Kept stable so it doesn't break the system-prompt cache prefix.
const CONTEXT_ACK = 'Entendido. Estou a par do teu progresso recente. Como posso ajudar?';

// ── Input schemas ─────────────────────────────────────────────────────────────

const chatSchema = z.object({
  // Client MUST NOT send history — we load it from DB to prevent injection
  message: z.string().trim().min(1).max(2000),
});

// ── GET /api/coach/history ────────────────────────────────────────────────────
router.get('/history', requireAuth, requireRole('client'), async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: true })
    .limit(60);

  if (error) { res.status(500).json({ error: 'Failed to fetch history' }); return; }
  res.json(data ?? []);
});

// ── POST /api/coach/chat — streaming SSE ──────────────────────────────────────
//
// Response: text/event-stream
//   data: {"text": "<delta>"}   — per token
//   data: [DONE]                — stream complete
//   data: {"error": "..."}      — on failure
//
// Security notes:
//  - History is loaded from DB, never from client (prevents prompt injection)
//  - AbortController terminates the Anthropic stream if client disconnects
//    (prevents wasting API credits on orphaned requests)
//  - Rate limited by aiLimiter (30 req / 15 min) in index.ts
//
router.post('/chat', requireAuth, requireRole('client'), async (req: AuthRequest, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { message } = parsed.data;

  const ctx = await buildCoachContext(req.userId!);

  if (!ctx.isEnabled) {
    res.status(403).json({
      error: 'ai_coach_not_enabled',
      message: 'O AI Coach não está ativo. Ativa-o nas Definições.',
    });
    return;
  }

  // Load last 12 messages from DB — never trust client-supplied history
  const { data: dbHistory } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })
    .limit(12);

  // DB returns newest first; Claude needs oldest first
  const history = (dbHistory ?? []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user',      content: ctx.recentContextMessage },
    { role: 'assistant', content: CONTEXT_ACK },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user',      content: message },
  ];

  // Persist user message (fire-and-forget)
  supabase.from('coach_messages').insert({
    user_id: req.userId!,
    role: 'user',
    content: message,
  }).then(() => {}).catch(() => {});

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // ── Abort stream when client disconnects ──────────────────────────────────
  // Without this, the Anthropic API call continues burning tokens even after
  // the client has closed the connection (tab close, navigation, app kill).
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  let fullResponse = '';

  try {
    const stream = anthropic.messages.stream(
      {
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        thinking: { type: 'adaptive' },
        system: ctx.systemBlocks as Anthropic.TextBlockParam[],
        messages,
      },
      { signal: controller.signal }
    );

    for await (const event of stream) {
      if (controller.signal.aborted) break;

      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // Persist assistant response (fire-and-forget)
    if (fullResponse) {
      supabase.from('coach_messages').insert({
        user_id: req.userId!,
        role: 'assistant',
        content: fullResponse,
      }).then(() => {}).catch(() => {});
    }

    if (!controller.signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  } catch (err) {
    // AbortError is expected when client disconnects — not a real error
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }
    console.error('[Coach] stream error:', err instanceof Error ? err.message : err);
    if (!res.headersSent) return;
    res.write(`data: ${JSON.stringify({ error: 'Erro ao processar resposta. Tenta novamente.' })}\n\n`);
  } finally {
    res.end();
  }
});

// ── generateCoachMealFeedback ─────────────────────────────────────────────────
// Called fire-and-forget from meals.ts after a meal is analysed.
// Uses Haiku (fast + cheap) for brief 1-2 sentence feedback.
// Silently skips if coach is not enabled or context unavailable.
//
export async function generateCoachMealFeedback(
  mealId: string,
  userId: string,
  analysis: {
    summary: string;
    score: number;
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  },
  mealType: string,
): Promise<void> {
  try {
    const ctx = await buildCoachContext(userId);
    if (!ctx.isEnabled) return;

    const prompt =
      `O utilizador acabou de registar uma refeição: ${mealType.replace(/_/g, ' ')}.\n\n` +
      `Resumo: ${analysis.summary}\n` +
      `Macros: ${analysis.macros.calories} kcal · ${analysis.macros.protein_g}g proteína · ` +
      `${analysis.macros.carbs_g}g hidratos · ${analysis.macros.fat_g}g gordura\n` +
      `Pontuação de alinhamento com objetivo: ${analysis.score}/10\n\n` +
      `Gera um comentário NutriCoach curto (1-2 frases). Específico, encorajador e prático.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: ctx.systemBlocks as Anthropic.TextBlockParam[],
      messages: [
        { role: 'user',      content: ctx.recentContextMessage },
        { role: 'assistant', content: CONTEXT_ACK },
        { role: 'user',      content: prompt },
      ],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return;

    await supabase
      .from('meals')
      .update({ coach_feedback: block.text })
      .eq('id', mealId);
  } catch (err) {
    // Best-effort — never propagate errors upstream
    console.error('[Coach] meal feedback error:', err instanceof Error ? err.message : err);
  }
}

export default router;
