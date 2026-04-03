import { Router, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { buildCoachContext } from '../lib/coachContext.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Stub assistant turn that anchors the volatile context ─────────────────────
// Placed after recentContextMessage in messages[], keeping the cached system
// prompt prefix completely stable across requests.
const CONTEXT_ACK = 'Entendido. Estou a par do teu progresso recente. Como posso ajudar?';

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
// Body: { message: string, history?: { role: 'user'|'assistant', content: string }[] }
//
// Response: text/event-stream
//   data: {"text": "<delta>"}        — one per token chunk
//   data: [DONE]                     — stream complete
//   data: {"error": "<message>"}     — on failure
//
router.post('/chat', requireAuth, requireRole('client'), async (req: AuthRequest, res: Response) => {
  const { message, history = [] } = req.body as {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const ctx = await buildCoachContext(req.userId!);

  if (!ctx.isEnabled) {
    res.status(403).json({
      error: 'ai_coach_not_enabled',
      message: 'O AI Coach não está ativo. Ativa-o nas Definições.',
    });
    return;
  }

  // ── Build message history ────────────────────────────────────────────────
  // Structure:
  //   [volatile context (user)] → [context ack (assistant)] → [...history] → [new message]
  //
  // The system blocks (with cache_control) sit in `system` — before all messages.
  // Any byte change there would bust the cache; volatile content is deliberately
  // kept in the messages array so the stable system prefix is never touched.
  const messages: Anthropic.MessageParam[] = [
    { role: 'user',      content: ctx.recentContextMessage },
    { role: 'assistant', content: CONTEXT_ACK },
    // Keep last 12 turns (~6 exchanges) to bound context window growth
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ];

  // Persist user message before streaming (fire-and-forget; no await)
  supabase.from('coach_messages').insert({
    user_id: req.userId!,
    role: 'user',
    content: message.trim(),
  }).then(() => {}).catch(() => {});

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  let fullResponse = '';

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: ctx.systemBlocks as Anthropic.TextBlockParam[],
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // Persist assistant response (non-blocking)
    if (fullResponse) {
      supabase.from('coach_messages').insert({
        user_id: req.userId!,
        role: 'assistant',
        content: fullResponse,
      }).then(() => {}).catch(() => {});
    }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    console.error('[Coach] stream error:', err instanceof Error ? err.message : err);
    res.write(`data: ${JSON.stringify({ error: 'Erro ao processar resposta. Tenta novamente.' })}\n\n`);
  } finally {
    res.end();
  }
});

// ── generateCoachMealFeedback ─────────────────────────────────────────────────
// Called internally from meals.ts after a meal is analysed.
// Non-blocking — caller does NOT await this.
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

    // Use Haiku for auto-feedback — fast and cheap; no streaming needed
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
    // Auto-feedback is best-effort; never throw
    console.error('[Coach] meal feedback error:', err instanceof Error ? err.message : err);
  }
}

export default router;
