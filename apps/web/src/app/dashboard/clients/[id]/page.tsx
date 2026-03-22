import { redirect, notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Target, Weight, Ruler, Percent } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import FeedbackEditor from './FeedbackEditor';

async function getClientData(clientId: string, token: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch client');
  return res.json();
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Snack',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_ai: { label: 'A analisar...', color: 'bg-gray-100 text-gray-500' },
  draft: { label: 'Rascunho pronto', color: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Feedback enviado', color: 'bg-brand-100 text-brand-700' },
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const data = await getClientData(id, session.access_token);
  if (!data) notFound();

  const { profile, meals } = data;

  return (
    <div className="p-8">
      <Link href="/dashboard/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={15} /> Todos os clientes
      </Link>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl">
            {profile.full_name?.[0] ?? '?'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-sm text-gray-400">Cliente desde {new Date(profile.created_at).toLocaleDateString('pt-PT')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: <Target size={15} />, label: 'Objetivo', value: profile.goal?.replace(/_/g, ' ') ?? '—' },
            { icon: <Weight size={15} />, label: 'Peso', value: profile.weight_kg ? `${profile.weight_kg} kg` : '—' },
            { icon: <Ruler size={15} />, label: 'Altura', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
            { icon: <Percent size={15} />, label: 'Massa gorda', value: profile.body_fat_pct ? `${profile.body_fat_pct}%` : '—' },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                {stat.icon} {stat.label}
              </div>
              <p className="font-semibold text-gray-900 text-sm">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <h2 className="font-semibold text-gray-900 mb-4">Refeições ({meals.length})</h2>

      {meals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
          Ainda sem refeições registadas.
        </div>
      ) : (
        <div className="space-y-4">
          {(meals as any[]).map((meal) => {
            const status = STATUS_LABELS[meal.feedback_status] ?? STATUS_LABELS.pending_ai;
            const analysis = meal.ai_analysis;

            return (
              <div key={meal.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="w-24 h-24 relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image src={meal.photo_url} alt="Refeição" fill className="object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mb-3">
                      {new Date(meal.eaten_at).toLocaleString('pt-PT', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>

                    {analysis && (
                      <div className="flex gap-3 text-xs">
                        {[
                          { label: 'kcal', value: analysis.macros.calories },
                          { label: 'prot', value: `${analysis.macros.protein_g}g` },
                          { label: 'hidr', value: `${analysis.macros.carbs_g}g` },
                          { label: 'gord', value: `${analysis.macros.fat_g}g` },
                          { label: 'score', value: `${analysis.score}/10` },
                        ].map((m) => (
                          <div key={m.label} className="bg-gray-50 rounded px-2 py-1 text-center">
                            <p className="font-semibold text-gray-700">{m.value}</p>
                            <p className="text-gray-400">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {analysis?.summary && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-600">IA: </span>
                      {analysis.summary}
                    </p>
                  </div>
                )}

                {analysis?.foods?.length > 0 && (
                  <div className="px-4 pb-2">
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.foods.map((food: any, i: number) => (
                        <span key={i} className="text-xs bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                          {food.name} ({food.portion_g}g)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <FeedbackEditor
                  mealId={meal.id}
                  aiDraft={meal.ai_feedback_draft}
                  currentFeedback={meal.nutritionist_feedback}
                  status={meal.feedback_status}
                  token={session.access_token}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
