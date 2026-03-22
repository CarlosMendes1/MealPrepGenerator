import { redirect } from 'next/navigation';
import { Users, Utensils, MessageSquare, TrendingUp } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';

async function getClients(token: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[getClients] API returned ${res.status}: ${body}`);
      return [];
    }
    return res.json();
  } catch (err) {
    console.error('[getClients] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export default async function DashboardPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  // Fetch session to get the access token for the API call
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const clients = await getClients(session.access_token);
  const clientCount = Array.isArray(clients) ? clients.length : 0;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Nutricionista';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">Aqui está o resumo de hoje</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Clientes ativos', value: clientCount, icon: <Users size={20} className="text-brand-600" />, bg: 'bg-brand-50' },
          { label: 'Refeições hoje', value: '—', icon: <Utensils size={20} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Feedback pendente', value: '—', icon: <MessageSquare size={20} className="text-amber-600" />, bg: 'bg-amber-50' },
          { label: 'Taxa de adesão média', value: '—', icon: <TrendingUp size={20} className="text-purple-600" />, bg: 'bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`${stat.bg} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Clientes recentes</h2>
          <a href="/dashboard/clients" className="text-sm text-brand-600 hover:underline">Ver todos</a>
        </div>

        {!clients || clients.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Ainda não tem clientes.</p>
            <a
              href="/dashboard/clients"
              className="inline-block mt-4 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition"
            >
              Adicionar primeiro cliente
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {(clients as any[]).slice(0, 5).map((client) => (
              <li key={client.user_id} className="px-6 py-4">
                <a href={`/dashboard/clients/${client.user_id}`} className="flex items-center justify-between hover:opacity-80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                      {client.full_name?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{client.full_name}</p>
                      <p className="text-xs text-gray-400">{client.goal?.replace(/_/g, ' ') ?? 'sem objetivo definido'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">ver →</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
