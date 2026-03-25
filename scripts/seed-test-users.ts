/**
 * Seed script — cria utilizadores de teste no Supabase
 * Uso: npx tsx scripts/seed-test-users.ts
 * Requer: apps/api/.env com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
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
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw new Error(`Erro ao criar ${email}: ${error.message}`);
  return data.user;
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

  // ── Ligar cliente ao nutricionista ───────────────────────────────────────
  const { error: linkError } = await supabase
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

  if (linkError) throw new Error(`Erro ao ligar cliente: ${linkError.message}`);
  console.log('✓ Cliente ligado ao nutricionista\n');

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
