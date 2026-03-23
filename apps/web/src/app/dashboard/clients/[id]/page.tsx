import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Target, Weight, Ruler, Percent, AlertCircle, Leaf, Clock } from 'lucide-react';
import Link from 'next/link';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import MealsSection from './MealsSection';
import NotesSection from './NotesSection';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getClientData(clientId: string, token: string) {
  const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch client');
  return res.json();
}

async function getClientNotes(clientId: string, token: string) {
  try {
    const res = await fetch(`${API_URL}/api/clients/${clientId}/notes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight:     'Perder peso',
  gain_muscle:     'Ganhar músculo',
  maintain:        'Manter peso',
  improve_health:  'Melhorar saúde',
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const [data, notes] = await Promise.all([
    getClientData(id, session.access_token),
    getClientNotes(id, session.access_token),
  ]);

  if (!data) notFound();

  const { profile, meals } = data;

  const hasDietaryInfo =
    profile.allergies || profile.intolerances || profile.dietary_preferences || profile.lifestyle_notes;

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/dashboard/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={15} /> Todos os clientes
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl">
            {profile.full_name?.[0] ?? '?'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-sm text-gray-400">Cliente desde {new Date(profile.created_at).toLocaleDateString('pt-PT')}</p>
          </div>
        </div>

        {/* Body metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: <Target size={15} />, label: 'Objetivo', value: GOAL_LABELS[profile.goal] ?? profile.goal?.replace(/_/g, ' ') ?? '—' },
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

      {/* Dietary profile */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Perfil dietético</h2>
        {hasDietaryInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <AlertCircle size={14} />, label: 'Alergias', value: profile.allergies },
              { icon: <AlertCircle size={14} />, label: 'Intolerâncias', value: profile.intolerances },
              { icon: <Leaf size={14} />, label: 'Preferências alimentares', value: profile.dietary_preferences },
              { icon: <Clock size={14} />, label: 'Estilo de vida / horários', value: profile.lifestyle_notes },
            ]
              .filter((item) => item.value)
              .map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                    {item.icon} {item.label}
                  </div>
                  <p className="text-sm text-gray-700">{item.value}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            O cliente ainda não preencheu as informações dietéticas.
          </p>
        )}
      </div>

      {/* Internal notes */}
      <div className="mb-4">
        <NotesSection clientId={id} initialNotes={notes} token={session.access_token} />
      </div>

      {/* Meals */}
      <h2 className="font-semibold text-gray-900 mb-4">Refeições ({meals.length})</h2>
      <MealsSection meals={meals} token={session.access_token} />
    </div>
  );
}
