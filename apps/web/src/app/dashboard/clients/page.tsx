import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import InviteButton from './InviteButton';
import ClientsTabSwitch from './ClientsTabSwitch';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchClients(token: string, context: 'personal' | 'team') {
  try {
    const res = await fetch(`${API_URL}/api/clients?context=${context}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getOrgContext(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/organizations/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight:    'Perder peso',
  gain_muscle:    'Ganhar músculo',
  maintain:       'Manter peso',
  improve_health: 'Melhorar saúde',
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const tab = searchParams.tab === 'team' ? 'team' : 'personal';
  const orgContext = await getOrgContext(session.access_token);
  const clients = await fetchClients(session.access_token, tab);

  const isTeamTab = tab === 'team' && !!orgContext;
  const orgName = orgContext?.organizations?.name;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''}{' '}
            {isTeamTab ? `da equipa` : 'pessoais'}
          </p>
        </div>
        {!isTeamTab && <InviteButton token={session.access_token} />}
      </div>

      {/* Tab switcher */}
      {orgContext && (
        <ClientsTabSwitch activeTab={tab} orgName={orgName} />
      )}

      {/* Client list */}
      <div className="mt-5">
        {clients.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
            <Users size={40} className="text-gray-200 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {isTeamTab ? 'Sem clientes na equipa' : 'Sem clientes ainda'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {isTeamTab
                ? 'Os clientes da equipa aparecem aqui quando forem registados.'
                : 'Gere um código de convite e partilhe com os seus clientes.'}
            </p>
            {!isTeamTab && <InviteButton token={session.access_token} variant="primary" />}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {(clients as any[]).map((client) => (
              <Link
                key={client.user_id}
                href={`/dashboard/clients/${client.user_id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                    {client.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{client.full_name ?? 'Sem nome'}</p>
                      {isTeamTab && client.nutritionist_id && client.nutritionist_id !== user.id && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                          outro membro
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {[
                        client.age ? `${client.age} anos` : null,
                        client.weight_kg ? `${client.weight_kg} kg` : null,
                        client.goal ? (GOAL_LABELS[client.goal] ?? client.goal.replace(/_/g, ' ')) : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{client.meals?.[0]?.count ?? 0}</p>
                    <p className="text-xs text-gray-400">refeições</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-gray-400 transition">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
