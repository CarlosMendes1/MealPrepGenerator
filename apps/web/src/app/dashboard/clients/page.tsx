import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import InviteButton from './InviteButton';

async function getClients(token: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API_URL}/api/clients`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight:    'Perder peso',
  gain_muscle:    'Ganhar músculo',
  maintain:       'Manter peso',
  improve_health: 'Melhorar saúde',
};

export default async function ClientsPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const clients = await getClients(session.access_token);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{clients.length} clientes ativos</p>
        </div>
        <InviteButton token={session.access_token} />
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <Users size={48} className="text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sem clientes ainda</h2>
          <p className="text-gray-500 text-sm mb-6">
            Gere um código de convite e partilhe com os seus clientes.
          </p>
          <InviteButton token={session.access_token} variant="primary" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {(clients as any[]).map((client) => (
            <Link
              key={client.user_id}
              href={`/dashboard/clients/${client.user_id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                  {client.full_name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{client.full_name ?? 'Sem nome'}</p>
                  <p className="text-xs text-gray-400">
                    {[
                      client.age ? `${client.age} anos` : null,
                      client.weight_kg ? `${client.weight_kg} kg` : null,
                      client.goal ? (GOAL_LABELS[client.goal] ?? client.goal.replace(/_/g, ' ')) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{client.meals?.[0]?.count ?? 0}</p>
                  <p className="text-xs text-gray-400">refeições</p>
                </div>
                <span className="text-gray-300">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
