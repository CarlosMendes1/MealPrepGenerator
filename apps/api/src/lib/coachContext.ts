/**
 * coachContext.ts
 *
 * Builds the AI Coach context for Claude requests.
 *
 * CACHING STRATEGY
 * ──────────────────────────────────────────────────────────────────────────
 * The system prompt is stable per user (name, goal, restrictions, targets).
 * We mark it with cache_control: { type: 'ephemeral' } so Claude's API
 * caches it for 5 minutes, dramatically cutting input token cost on
 * repeated conversations.
 *
 * Volatile data (recent meals, last feedback) is injected as the FIRST
 * user message in the conversation — AFTER the cached prefix — so it
 * never invalidates the cache.
 *
 * Render order: system → messages
 * Cached prefix: system prompt only (stable per user)
 * Volatile: first user turn (changes per session / every few hours)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../services/supabase.js';
import type { Goal } from '../types/index.js';
import type Anthropic from '@anthropic-ai/sdk';

// ── Targets per goal ──────────────────────────────────────────────────────────
const DAILY_TARGETS: Record<Goal, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {
  lose_weight:     { calories: 1600, protein_g: 130, carbs_g: 150, fat_g: 55 },
  gain_muscle:     { calories: 2600, protein_g: 180, carbs_g: 280, fat_g: 85 },
  maintain:        { calories: 2000, protein_g: 120, carbs_g: 220, fat_g: 70 },
  improve_health:  { calories: 1900, protein_g: 110, carbs_g: 200, fat_g: 65 },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoachContext {
  /**
   * Stable system prompt — annotated with cache_control so Claude caches it.
   * Include in `system` field of the API call as a text block array.
   */
  systemBlocks: Anthropic.TextBlockParam[];

  /**
   * Volatile context snippet — inject as the first user message in the
   * conversation array, followed by a stub assistant acknowledgement.
   * This keeps the stable cache prefix intact.
   */
  recentContextMessage: string;

  /** Whether the user has AI Coach enabled on their plan. */
  isEnabled: boolean;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export async function buildCoachContext(userId: string): Promise<CoachContext> {
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel queries — keeps the total DB round-trip to one network hop
  const [profileResult, mealsResult, feedbackResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'full_name, goal, age, weight_kg, height_cm, allergies, intolerances, dietary_preferences, lifestyle_notes, ai_coach_enabled'
      )
      .eq('user_id', userId)
      .single(),

    // Last 7 days — only macro summaries, not photos or full objects
    supabase
      .from('meals')
      .select('meal_type, eaten_at, ai_analysis')
      .eq('client_id', userId)
      .gte('eaten_at', SEVEN_DAYS_AGO)
      .order('eaten_at', { ascending: false })
      .limit(30),

    // Last 3 nutritionist feedback messages
    supabase
      .from('meals')
      .select('eaten_at, meal_type, nutritionist_feedback')
      .eq('client_id', userId)
      .not('nutritionist_feedback', 'is', null)
      .order('eaten_at', { ascending: false })
      .limit(3),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return { systemBlocks: [], recentContextMessage: '', isEnabled: false };
  }

  const goal = (profile.goal as Goal) ?? 'maintain';
  const targets = DAILY_TARGETS[goal];
  const meals   = mealsResult.data  ?? [];
  const fbMeals = feedbackResult.data ?? [];

  // ── 1. Cacheable system prompt ────────────────────────────────────────────
  const restrictions = [
    profile.allergies      ? `Alergias: ${profile.allergies}`             : '',
    profile.intolerances   ? `Intolerâncias: ${profile.intolerances}`     : '',
    profile.dietary_preferences ? `Preferências: ${profile.dietary_preferences}` : '',
    profile.lifestyle_notes ? `Notas lifestyle: ${profile.lifestyle_notes}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt = `És o NutriCoach, um assistente de nutrição integrado na app NutriDesk.

O teu papel é complementar — nunca substituir — o nutricionista humano do utilizador. Ajudas no dia-a-dia: motivação, dúvidas de nutrição, avaliação de refeições e hábitos saudáveis.

## Perfil do utilizador
Nome: ${profile.full_name ?? 'Utilizador'}
Objetivo: ${goal.replace(/_/g, ' ')}
Idade: ${profile.age ?? '—'} | Peso: ${profile.weight_kg ? `${profile.weight_kg} kg` : '—'} | Altura: ${profile.height_cm ? `${profile.height_cm} cm` : '—'}
Metas diárias: ${targets.calories} kcal · ${targets.protein_g}g proteína · ${targets.carbs_g}g hidratos · ${targets.fat_g}g gordura
${restrictions ? `\n## Restrições\n${restrictions}` : ''}

## Regras
- Responde sempre em português de Portugal
- Sê encorajador, concreto e breve (máx. 3 parágrafos, salvo pedido específico)
- Para questões médicas ou de medicação, redireciona para o nutricionista ou médico
- Não diagnostiques doenças nem prescreves suplementos sem recomendação profissional
- Usa emojis com moderação`;

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: systemPrompt,
      // @ts-expect-error cache_control is not in the base type but is valid
      cache_control: { type: 'ephemeral' },
    },
  ];

  // ── 2. Volatile recent context ────────────────────────────────────────────
  // Group meals by day → aggregate macros per day
  const byDay = new Map<string, { calories: number; protein: number; count: number }>();
  for (const m of meals) {
    const day = m.eaten_at.split('T')[0];
    const macros = (m.ai_analysis as any)?.macros;
    const prev = byDay.get(day) ?? { calories: 0, protein: 0, count: 0 };
    byDay.set(day, {
      calories: prev.calories + (macros?.calories ?? 0),
      protein:  prev.protein  + (macros?.protein_g ?? 0),
      count:    prev.count    + 1,
    });
  }

  let recentContextMessage = '## Contexto recente\n';

  if (byDay.size > 0) {
    recentContextMessage += 'Refeições dos últimos 7 dias (resumo por dia):\n';
    for (const [day, data] of Array.from(byDay.entries()).slice(0, 5)) {
      recentContextMessage +=
        `• ${day}: ${data.count} refeição(ões) · ~${Math.round(data.calories)} kcal · ~${Math.round(data.protein)}g proteína\n`;
    }
  } else {
    recentContextMessage += 'Nenhuma refeição registada nos últimos 7 dias.\n';
  }

  if (fbMeals.length > 0) {
    recentContextMessage += '\nÚltimo feedback do nutricionista:\n';
    for (const m of fbMeals) {
      recentContextMessage += `• "${m.nutritionist_feedback?.slice(0, 140)}"\n`;
    }
  }

  return {
    systemBlocks,
    recentContextMessage,
    isEnabled: profile.ai_coach_enabled ?? false,
  };
}
