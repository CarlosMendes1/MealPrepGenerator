/**
 * Seed script — cria utilizadores e refeições de teste no Supabase
 * Uso: npx tsx scripts/seed-test-users.ts
 * Requer: apps/api/.env com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/api/.env') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createUser(
  email: string,
  password: string,
  role: 'nutritionist' | 'client',
  fullName: string
) {
  // Se já existir, devolve o utilizador existente
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  (já existe) ${email}`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw new Error(`Erro ao criar ${email}: ${error.message}`);
  return data.user;
}

function daysAgo(n: number, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function main() {
  console.log('A criar utilizadores de teste...\n');

  // ── Nutricionista ────────────────────────────────────────────────────────
  const nutritionist = await createUser(
    'nutricionista@teste.com',
    'Teste1234!',
    'nutritionist',
    'Ana Ferreira'
  );
  console.log(`✓ Nutricionista: nutricionista@teste.com  |  id: ${nutritionist.id}`);

  // ── Cliente ──────────────────────────────────────────────────────────────
  const client = await createUser(
    'cliente@teste.com',
    'Teste1234!',
    'client',
    'João Silva'
  );
  console.log(`✓ Cliente:        cliente@teste.com        |  id: ${client.id}`);

  // ── Perfil do cliente ────────────────────────────────────────────────────
  await supabase
    .from('profiles')
    .update({
      nutritionist_id: nutritionist.id,
      age: 28,
      weight_kg: 78.5,
      height_cm: 178,
      body_fat_pct: 18.0,
      goal: 'lose_weight',
      allergies: 'Amendoins',
      intolerances: 'Lactose',
      dietary_preferences: 'Sem glúten',
      lifestyle_notes: 'Trabalho das 9h às 18h, treino ao fim de tarde',
    })
    .eq('user_id', client.id);

  console.log('✓ Perfil do cliente atualizado\n');

  // ── Refeições ────────────────────────────────────────────────────────────
  console.log('A criar refeições de teste...\n');

  const meals = [
    // Hoje
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
      meal_type: 'breakfast',
      eaten_at: daysAgo(0, 8, 30),
      client_notes: 'Ovos mexidos com torrada integral e sumo de laranja',
      ai_analysis: {
        foods: [
          { name: 'Ovos mexidos', portion_g: 150, calories: 220, protein_g: 16, carbs_g: 2, fat_g: 16 },
          { name: 'Torrada integral', portion_g: 60, calories: 150, protein_g: 5, carbs_g: 28, fat_g: 2 },
          { name: 'Sumo de laranja', portion_g: 200, calories: 90, protein_g: 1, carbs_g: 21, fat_g: 0 },
        ],
        macros: { calories: 460, protein_g: 22, carbs_g: 51, fat_g: 18, fiber_g: 4 },
        score: 7,
        summary: 'Pequeno-almoço equilibrado com boa proteína e hidratos complexos.',
      },
      ai_feedback_draft: 'Bom pequeno-almoço, João! Os ovos fornecem proteína de qualidade. Tenta substituir o sumo natural por fruta inteira para mais fibra e menos pico de açúcar.',
      nutritionist_feedback: 'Bom pequeno-almoço, João! Os ovos fornecem proteína de qualidade. Tenta substituir o sumo natural por fruta inteira para mais fibra e menos pico de açúcar.',
      feedback_status: 'sent',
    },
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
      meal_type: 'lunch',
      eaten_at: daysAgo(0, 13, 0),
      client_notes: 'Salada de frango grelhado com quinoa e legumes',
      ai_analysis: {
        foods: [
          { name: 'Frango grelhado', portion_g: 180, calories: 270, protein_g: 42, carbs_g: 0, fat_g: 9 },
          { name: 'Quinoa cozida', portion_g: 150, calories: 180, protein_g: 6, carbs_g: 33, fat_g: 3 },
          { name: 'Legumes variados', portion_g: 200, calories: 80, protein_g: 3, carbs_g: 14, fat_g: 1 },
          { name: 'Azeite', portion_g: 10, calories: 90, protein_g: 0, carbs_g: 0, fat_g: 10 },
        ],
        macros: { calories: 620, protein_g: 51, carbs_g: 47, fat_g: 23, fiber_g: 8 },
        score: 9,
        summary: 'Almoço excelente com proteína elevada e gorduras saudáveis.',
      },
      ai_feedback_draft: 'Almoço excelente! A combinação de frango com quinoa é perfeita para o teu objetivo de perda de peso. Continua assim!',
      nutritionist_feedback: null,
      feedback_status: 'draft',
    },
    // Ontem
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800',
      meal_type: 'breakfast',
      eaten_at: daysAgo(1, 8, 0),
      client_notes: 'Iogurte com granola e morangos',
      ai_analysis: {
        foods: [
          { name: 'Iogurte grego', portion_g: 200, calories: 160, protein_g: 16, carbs_g: 8, fat_g: 6 },
          { name: 'Granola', portion_g: 50, calories: 220, protein_g: 5, carbs_g: 32, fat_g: 8 },
          { name: 'Morangos', portion_g: 100, calories: 32, protein_g: 1, carbs_g: 8, fat_g: 0 },
        ],
        macros: { calories: 412, protein_g: 22, carbs_g: 48, fat_g: 14, fiber_g: 5 },
        score: 7,
        summary: 'Bom pequeno-almoço com proteína e frutas frescas.',
      },
      ai_feedback_draft: 'Boa escolha de pequeno-almoço! Atenção à quantidade de granola — tende a ter muito açúcar adicionado. Tenta optar por uma versão sem açúcar.',
      nutritionist_feedback: 'Boa escolha de pequeno-almoço! Atenção à quantidade de granola — tende a ter muito açúcar adicionado. Tenta optar por uma versão sem açúcar.',
      feedback_status: 'sent',
    },
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      meal_type: 'lunch',
      eaten_at: daysAgo(1, 12, 30),
      client_notes: 'Hambúrguer com batatas fritas',
      ai_analysis: {
        foods: [
          { name: 'Hambúrguer', portion_g: 200, calories: 520, protein_g: 28, carbs_g: 38, fat_g: 28 },
          { name: 'Batatas fritas', portion_g: 150, calories: 450, protein_g: 5, carbs_g: 58, fat_g: 22 },
        ],
        macros: { calories: 970, protein_g: 33, carbs_g: 96, fat_g: 50, fiber_g: 3 },
        score: 3,
        summary: 'Refeição com excesso calórico e gordura saturada elevada.',
      },
      ai_feedback_draft: 'João, este almoço está acima do ideal para o teu objetivo. Muita gordura saturada e calorias. Tenta optar por alternativas mais leves quando comeres fora — grelhados, saladas ou wraps são boas opções.',
      nutritionist_feedback: 'João, este almoço está acima do ideal para o teu objetivo. Muita gordura saturada e calorias. Tenta optar por alternativas mais leves quando comeres fora — grelhados, saladas ou wraps são boas opções.',
      feedback_status: 'sent',
    },
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800',
      meal_type: 'dinner',
      eaten_at: daysAgo(1, 20, 0),
      client_notes: 'Sopa de legumes e peixe grelhado',
      ai_analysis: {
        foods: [
          { name: 'Sopa de legumes', portion_g: 300, calories: 120, protein_g: 4, carbs_g: 22, fat_g: 2 },
          { name: 'Salmão grelhado', portion_g: 200, calories: 310, protein_g: 40, carbs_g: 0, fat_g: 15 },
        ],
        macros: { calories: 430, protein_g: 44, carbs_g: 22, fat_g: 17, fiber_g: 6 },
        score: 9,
        summary: 'Jantar muito equilibrado, leve e nutritivo.',
      },
      ai_feedback_draft: 'Jantar perfeito para o teu objetivo! Salmão rico em ómega-3 e sopa de legumes com baixo teor calórico. Excelente escolha!',
      nutritionist_feedback: 'Jantar perfeito para o teu objetivo! Salmão rico em ómega-3 e sopa de legumes com baixo teor calórico. Excelente escolha!',
      feedback_status: 'sent',
    },
    // 3 dias atrás
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
      meal_type: 'breakfast',
      eaten_at: daysAgo(3, 9, 0),
      client_notes: null,
      ai_analysis: {
        foods: [
          { name: 'Panquecas', portion_g: 200, calories: 380, protein_g: 9, carbs_g: 58, fat_g: 14 },
          { name: 'Mel', portion_g: 20, calories: 60, protein_g: 0, carbs_g: 16, fat_g: 0 },
          { name: 'Banana', portion_g: 120, calories: 107, protein_g: 1, carbs_g: 27, fat_g: 0 },
        ],
        macros: { calories: 547, protein_g: 10, carbs_g: 101, fat_g: 14, fiber_g: 4 },
        score: 4,
        summary: 'Pequeno-almoço com excesso de hidratos simples e baixa proteína.',
      },
      ai_feedback_draft: 'As panquecas são saborosas mas têm muitos hidratos simples e pouca proteína para o teu objetivo. Considera adicionar ovos ou iogurte grego para equilibrar.',
      nutritionist_feedback: null,
      feedback_status: 'draft',
    },
    {
      client_id: client.id,
      photo_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
      meal_type: 'lunch',
      eaten_at: daysAgo(3, 13, 30),
      client_notes: 'Frango com arroz e brócolos',
      ai_analysis: {
        foods: [
          { name: 'Peito de frango', portion_g: 200, calories: 300, protein_g: 46, carbs_g: 0, fat_g: 10 },
          { name: 'Arroz integral', portion_g: 150, calories: 195, protein_g: 4, carbs_g: 42, fat_g: 1 },
          { name: 'Brócolos cozidos', portion_g: 150, calories: 45, protein_g: 5, carbs_g: 8, fat_g: 0 },
        ],
        macros: { calories: 540, protein_g: 55, carbs_g: 50, fat_g: 11, fiber_g: 7 },
        score: 9,
        summary: 'Almoço de treino excelente, muito rico em proteína.',
      },
      ai_feedback_draft: 'Almoço de atleta! Proteína muito elevada, hidratos complexos e fibra dos brócolos. Continua com esta consistência.',
      nutritionist_feedback: 'Almoço de atleta! Proteína muito elevada, hidratos complexos e fibra dos brócolos. Continua com esta consistência.',
      feedback_status: 'sent',
    },
  ];

  const { error: mealsError } = await supabase.from('meals').insert(meals);
  if (mealsError) throw new Error(`Erro ao criar refeições: ${mealsError.message}`);
  console.log(`✓ ${meals.length} refeições criadas (últimos 3 dias)\n`);

  console.log('─────────────────────────────────────────');
  console.log('Credenciais de teste:');
  console.log('');
  console.log('  Nutricionista (web dashboard)');
  console.log('  Email:    nutricionista@teste.com');
  console.log('  Password: Teste1234!');
  console.log('');
  console.log('  Cliente (app mobile)');
  console.log('  Email:    cliente@teste.com');
  console.log('  Password: Teste1234!');
  console.log('─────────────────────────────────────────');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
