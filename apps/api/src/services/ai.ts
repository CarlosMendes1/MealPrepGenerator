import Anthropic from '@anthropic-ai/sdk';
import type { Goal, MealAnalysis, DailyTargets } from '../types/index.js';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DAILY_TARGETS: Record<Goal, DailyTargets> = {
  lose_weight: { calories: 1600, protein_g: 130, carbs_g: 150, fat_g: 55 },
  gain_muscle: { calories: 2600, protein_g: 180, carbs_g: 280, fat_g: 85 },
  maintain: { calories: 2000, protein_g: 120, carbs_g: 220, fat_g: 70 },
  improve_health: { calories: 1900, protein_g: 110, carbs_g: 200, fat_g: 65 },
};

export async function analyzeMealPhoto(
  imageBase64: string,
  mimeType: string,
  clientGoal: Goal,
  clientAge?: number,
  clientWeightKg?: number,
  clientNotes?: string | null
): Promise<{ analysis: MealAnalysis; feedbackDraft: string }> {
  const targets = DAILY_TARGETS[clientGoal];

  const notesSection = clientNotes?.trim()
    ? `\nClient notes about this meal (use this to improve accuracy — trust it over visual guesses):\n"${clientNotes.trim()}"\n`
    : '';

  const prompt = `You are a professional nutritionist analyzing a meal photo.

Client profile:
- Goal: ${clientGoal.replace(/_/g, ' ')}
- Age: ${clientAge ?? 'unknown'}
- Weight: ${clientWeightKg ? `${clientWeightKg} kg` : 'unknown'}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat
${notesSection}
Analyze this meal photo and respond in valid JSON only (no markdown, no extra text) with this exact structure:
{
  "analysis": {
    "foods": [
      {
        "name": "food name",
        "portion_g": 150,
        "calories": 250,
        "protein_g": 20,
        "carbs_g": 30,
        "fat_g": 8
      }
    ],
    "macros": {
      "calories": 500,
      "protein_g": 35,
      "carbs_g": 60,
      "fat_g": 15,
      "fiber_g": 5
    },
    "score": 7,
    "summary": "Brief summary of what the meal contains"
  },
  "feedbackDraft": "Personalized feedback in Portuguese for the client about this meal in relation to their goal. Be encouraging but specific. 2-3 sentences."
}

Score (1-10): how well this meal aligns with the client's goal.
Estimate portions based on visual cues and client notes. If the client provided ingredient details, use those as the primary source for food identification and quantities.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const parsed = JSON.parse(content.text);
  return {
    analysis: parsed.analysis as MealAnalysis,
    feedbackDraft: parsed.feedbackDraft as string,
  };
}

export async function analyzeMealText(
  clientGoal: Goal,
  clientAge?: number | null,
  clientWeightKg?: number | null,
  clientNotes?: string | null
): Promise<{ analysis: MealAnalysis; feedbackDraft: string }> {
  const targets = DAILY_TARGETS[clientGoal];

  const prompt = `You are a professional nutritionist estimating meal macros from a text description and ingredient list.

Client profile:
- Goal: ${clientGoal.replace(/_/g, ' ')}
- Age: ${clientAge ?? 'unknown'}
- Weight: ${clientWeightKg ? `${clientWeightKg} kg` : 'unknown'}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat

Meal description and ingredients:
${clientNotes ?? '(no description provided)'}

If specific ingredient quantities are provided, use them as the primary source for calculations.
For missing quantities, make reasonable estimates based on typical serving sizes.

Respond in valid JSON only (no markdown, no extra text) with this exact structure:
{
  "analysis": {
    "foods": [
      {
        "name": "food name",
        "portion_g": 150,
        "calories": 250,
        "protein_g": 20,
        "carbs_g": 30,
        "fat_g": 8
      }
    ],
    "macros": {
      "calories": 500,
      "protein_g": 35,
      "carbs_g": 60,
      "fat_g": 15,
      "fiber_g": 5
    },
    "score": 7,
    "summary": "Brief summary of what the meal contains"
  },
  "feedbackDraft": "Personalized feedback in Portuguese for the client about this meal in relation to their goal. Be encouraging but specific. 2-3 sentences."
}

Score (1-10): how well this meal aligns with the client's goal.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from AI');

  const parsed = JSON.parse(content.text);
  return {
    analysis: parsed.analysis as MealAnalysis,
    feedbackDraft: parsed.feedbackDraft as string,
  };
}

export async function generateDailySummary(
  meals: Array<{ analysis: MealAnalysis | null; meal_type: string }>,
  clientGoal: Goal,
  clientName: string
): Promise<string> {
  const targets = DAILY_TARGETS[clientGoal];
  const totals = meals.reduce(
    (acc, meal) => {
      if (!meal.analysis) return acc;
      return {
        calories: acc.calories + meal.analysis.macros.calories,
        protein_g: acc.protein_g + meal.analysis.macros.protein_g,
        carbs_g: acc.carbs_g + meal.analysis.macros.carbs_g,
        fat_g: acc.fat_g + meal.analysis.macros.fat_g,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const prompt = `You are a nutritionist. Write a brief daily summary in Portuguese for client ${clientName}.

Goal: ${clientGoal.replace(/_/g, ' ')}
Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat
Today's totals: ${totals.calories} kcal, ${totals.protein_g}g protein, ${totals.carbs_g}g carbs, ${totals.fat_g}g fat
Meals logged: ${meals.length}

Write a 2-3 sentence summary highlighting what went well and one specific improvement for tomorrow. Be encouraging and concrete.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return content.text;
}
