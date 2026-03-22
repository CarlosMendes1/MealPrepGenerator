/**
 * NutriDesk — Seed script for development/testing
 *
 * Creates:
 *   • 1 nutritionist  →  nutricionista@nutridesk.pt  /  NutriDesk2024!
 *   • 10 clients      →  clienteN@nutridesk.pt       /  NutriDesk2024!
 *   • 3–6 meals per client with realistic mock AI analysis (no Anthropic calls)
 *   • Mix of feedback statuses: pending_ai, draft, sent
 *
 * Usage:
 *   cd apps/api
 *   npx tsx scripts/seed.ts
 *
 * Re-running is safe — it skips users that already exist (by email).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Validate env ──────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Seed data ────────────────────────────────────────────────────────────────

const NUTRITIONIST = {
  email: 'nutricionista@nutridesk.pt',
  password: 'NutriDesk2024!',
  full_name: 'Dra. Ana Silva',
};

const CLIENTS = [
  { email: 'cliente1@nutridesk.pt', full_name: 'Carlos Mendes',    age: 34, weight_kg: 87,  height_cm: 178, body_fat_pct: 22, goal: 'lose_weight'     },
  { email: 'cliente2@nutridesk.pt', full_name: 'Mariana Costa',    age: 28, weight_kg: 62,  height_cm: 165, body_fat_pct: 24, goal: 'improve_health'   },
  { email: 'cliente3@nutridesk.pt', full_name: 'João Ferreira',    age: 42, weight_kg: 95,  height_cm: 182, body_fat_pct: 28, goal: 'lose_weight'     },
  { email: 'cliente4@nutridesk.pt', full_name: 'Sofia Rodrigues',  age: 25, weight_kg: 55,  height_cm: 162, body_fat_pct: 20, goal: 'gain_muscle'     },
  { email: 'cliente5@nutridesk.pt', full_name: 'Miguel Santos',    age: 31, weight_kg: 78,  height_cm: 175, body_fat_pct: 18, goal: 'maintain'        },
  { email: 'cliente6@nutridesk.pt', full_name: 'Inês Oliveira',    age: 38, weight_kg: 70,  height_cm: 170, body_fat_pct: 26, goal: 'lose_weight'     },
  { email: 'cliente7@nutridesk.pt', full_name: 'Rui Pereira',      age: 22, weight_kg: 68,  height_cm: 176, body_fat_pct: 12, goal: 'gain_muscle'     },
  { email: 'cliente8@nutridesk.pt', full_name: 'Beatriz Lopes',    age: 45, weight_kg: 75,  height_cm: 168, body_fat_pct: 30, goal: 'improve_health'  },
  { email: 'cliente9@nutridesk.pt', full_name: 'André Martins',    age: 29, weight_kg: 83,  height_cm: 180, body_fat_pct: 16, goal: 'maintain'        },
  { email: 'cliente10@nutridesk.pt', full_name: 'Catarina Nunes',  age: 33, weight_kg: 59,  height_cm: 163, body_fat_pct: 22, goal: 'improve_health'  },
] as const;

// Realistic food + macro data per meal type
const MEAL_TEMPLATES = {
  breakfast: [
    {
      foods: [
        { name: 'Iogurte grego', portion_g: 200, calories: 130, protein_g: 12, carbs_g: 10, fat_g: 5 },
        { name: 'Granola', portion_g: 40, calories: 180, protein_g: 4, carbs_g: 30, fat_g: 6 },
        { name: 'Mirtilos', portion_g: 80, calories: 45, protein_g: 1, carbs_g: 11, fat_g: 0 },
      ],
      macros: { calories: 355, protein_g: 17, carbs_g: 51, fat_g: 11, fiber_g: 4 },
      summary: 'Pequeno-almoço equilibrado com boa dose de proteína e hidratos de carbono de qualidade.',
    },
    {
      foods: [
        { name: 'Ovos mexidos', portion_g: 150, calories: 215, protein_g: 18, carbs_g: 2, fat_g: 15 },
        { name: 'Pão integral', portion_g: 60, calories: 140, protein_g: 5, carbs_g: 26, fat_g: 2 },
        { name: 'Abacate', portion_g: 50, calories: 80, protein_g: 1, carbs_g: 4, fat_g: 7 },
      ],
      macros: { calories: 435, protein_g: 24, carbs_g: 32, fat_g: 24, fiber_g: 6 },
      summary: 'Excelente pequeno-almoço proteico com gorduras saudáveis. Ideal para saciedade prolongada.',
    },
  ],
  lunch: [
    {
      foods: [
        { name: 'Frango grelhado', portion_g: 180, calories: 297, protein_g: 56, carbs_g: 0, fat_g: 6 },
        { name: 'Arroz integral', portion_g: 150, calories: 195, protein_g: 4, carbs_g: 41, fat_g: 2 },
        { name: 'Brócolos cozidos', portion_g: 120, calories: 40, protein_g: 4, carbs_g: 6, fat_g: 0 },
        { name: 'Azeite', portion_g: 10, calories: 90, protein_g: 0, carbs_g: 0, fat_g: 10 },
      ],
      macros: { calories: 622, protein_g: 64, carbs_g: 47, fat_g: 18, fiber_g: 8 },
      summary: 'Almoço muito completo e alinhado com o objetivo. Ótimo rácio proteico.',
    },
    {
      foods: [
        { name: 'Salmão no forno', portion_g: 200, calories: 412, protein_g: 40, carbs_g: 0, fat_g: 27 },
        { name: 'Batata-doce', portion_g: 200, calories: 180, protein_g: 2, carbs_g: 41, fat_g: 0 },
        { name: 'Salada mista', portion_g: 100, calories: 25, protein_g: 2, carbs_g: 4, fat_g: 0 },
      ],
      macros: { calories: 617, protein_g: 44, carbs_g: 45, fat_g: 27, fiber_g: 7 },
      summary: 'Refeição rica em ómega-3 e antioxidantes. Excelente escolha para saúde cardiovascular.',
    },
  ],
  dinner: [
    {
      foods: [
        { name: 'Bacalhau grelhado', portion_g: 200, calories: 220, protein_g: 48, carbs_g: 0, fat_g: 2 },
        { name: 'Grão-de-bico cozido', portion_g: 150, calories: 245, protein_g: 15, carbs_g: 41, fat_g: 4 },
        { name: 'Legumes salteados', portion_g: 150, calories: 75, protein_g: 3, carbs_g: 12, fat_g: 2 },
      ],
      macros: { calories: 540, protein_g: 66, carbs_g: 53, fat_g: 8, fiber_g: 12 },
      summary: 'Jantar leve e nutritivo. Combinação de proteína magra com leguminosas ricas em fibra.',
    },
    {
      foods: [
        { name: 'Omelete de claras', portion_g: 200, calories: 160, protein_g: 28, carbs_g: 4, fat_g: 4 },
        { name: 'Legumes variados', portion_g: 200, calories: 80, protein_g: 4, carbs_g: 14, fat_g: 1 },
        { name: 'Queijo fresco', portion_g: 50, calories: 45, protein_g: 6, carbs_g: 1, fat_g: 2 },
      ],
      macros: { calories: 285, protein_g: 38, carbs_g: 19, fat_g: 7, fiber_g: 5 },
      summary: 'Jantar hipocalórico e rico em proteína. Boa escolha para dias de défice calórico.',
    },
  ],
  snack: [
    {
      foods: [
        { name: 'Maçã', portion_g: 180, calories: 95, protein_g: 0, carbs_g: 25, fat_g: 0 },
        { name: 'Amêndoas', portion_g: 30, calories: 174, protein_g: 6, carbs_g: 6, fat_g: 15 },
      ],
      macros: { calories: 269, protein_g: 6, carbs_g: 31, fat_g: 15, fiber_g: 5 },
      summary: 'Snack equilibrado com fibra, gorduras saudáveis e açúcares naturais.',
    },
    {
      foods: [
        { name: 'Batido de proteína', portion_g: 300, calories: 180, protein_g: 30, carbs_g: 12, fat_g: 3 },
        { name: 'Banana', portion_g: 100, calories: 89, protein_g: 1, carbs_g: 23, fat_g: 0 },
      ],
      macros: { calories: 269, protein_g: 31, carbs_g: 35, fat_g: 3, fiber_g: 2 },
      summary: 'Snack pós-treino ideal. Boa janela de recuperação muscular.',
    },
  ],
};

const FEEDBACK_SAMPLES = [
  'Muito bom trabalho hoje! As tuas escolhas alimentares estão alinhadas com o objetivo. Continua assim!',
  'Atenção à quantidade de hidratos ao jantar. Tenta reduzir a porção de arroz para 100g.',
  'Excelente fonte de proteína! Nota que podes adicionar mais vegetais para aumentar a fibra.',
  'Parabéns pela consistência! Este tipo de refeição é exatamente o que precisas para atingir o objetivo.',
  'Boa escolha de gorduras saudáveis. O abacate e as amêndoas são excelentes para o perfil lipídico.',
];

// Photo URLs from Unsplash (food images, free to use)
const MEAL_PHOTOS: Record<string, string[]> = {
  breakfast: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800',
  ],
  lunch: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  ],
  dinner: [
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
    'https://images.unsplash.com/photo-1481671703460-040cb8a2d909?w=800',
  ],
  snack: [
    'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function randomScore(goal: string): number {
  // Simulate varying adherence
  const base = goal === 'lose_weight' ? 6 : goal === 'gain_muscle' ? 7 : 7;
  return Math.min(10, Math.max(4, base + Math.round((Math.random() - 0.5) * 4)));
}

async function findOrCreateUser(email: string, password: string, metadata: Record<string, string>) {
  // Check if user already exists
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ↳ already exists: ${email}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation for test users
    user_metadata: metadata,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create user ${email}: ${error?.message}`);
  }
  return data.user.id;
}

async function upsertProfile(userId: string, profile: Record<string, unknown>) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' });

  if (error) throw new Error(`Failed to upsert profile for ${userId}: ${error.message}`);
}

async function seedMeals(clientId: string, goal: string, count: number) {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const statuses = ['pending_ai', 'draft', 'sent'] as const;

  const meals = [];
  for (let i = 0; i < count; i++) {
    const mealType = pick(mealTypes);
    const template = pick(MEAL_TEMPLATES[mealType]);
    const photo = pick(MEAL_PHOTOS[mealType]);
    const status = pick(statuses);
    const score = randomScore(goal);

    const analysis = {
      foods: template.foods,
      macros: template.macros,
      score,
      summary: template.summary,
    };

    meals.push({
      client_id: clientId,
      photo_url: photo,
      meal_type: mealType,
      eaten_at: daysAgo(Math.floor(Math.random() * 14)), // last 2 weeks
      feedback_status: status,
      ai_analysis: analysis,
      ai_feedback_draft: `[Rascunho IA] ${template.summary} Score de adesão: ${score}/10.`,
      nutritionist_feedback: status === 'sent' ? pick(FEEDBACK_SAMPLES) : null,
    });
  }

  const { error } = await supabase.from('meals').insert(meals);
  if (error) throw new Error(`Failed to seed meals: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 NutriDesk seed started...\n');

  // 1. Nutritionist
  console.log('→ Nutritionist');
  const nutritionistId = await findOrCreateUser(
    NUTRITIONIST.email,
    NUTRITIONIST.password,
    { full_name: NUTRITIONIST.full_name, role: 'nutritionist' }
  );
  await upsertProfile(nutritionistId, {
    role: 'nutritionist',
    full_name: NUTRITIONIST.full_name,
  });
  console.log(`  ✓ ${NUTRITIONIST.full_name} (${NUTRITIONIST.email})\n`);

  // 2. Clients
  console.log('→ Clients');
  for (const client of CLIENTS) {
    const clientId = await findOrCreateUser(
      client.email,
      'NutriDesk2024!',
      { full_name: client.full_name, role: 'client' }
    );

    await upsertProfile(clientId, {
      role: 'client',
      full_name: client.full_name,
      age: client.age,
      weight_kg: client.weight_kg,
      height_cm: client.height_cm,
      body_fat_pct: client.body_fat_pct,
      goal: client.goal,
      nutritionist_id: nutritionistId,
    });

    // 3–6 meals per client
    const mealCount = 3 + Math.floor(Math.random() * 4);
    await seedMeals(clientId, client.goal, mealCount);

    console.log(`  ✓ ${client.full_name.padEnd(20)} ${client.goal.padEnd(16)} ${mealCount} meals`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  Login como nutricionista:                      │');
  console.log('│  Email:    nutricionista@nutridesk.pt           │');
  console.log('│  Password: NutriDesk2024!                       │');
  console.log('└─────────────────────────────────────────────────┘\n');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
