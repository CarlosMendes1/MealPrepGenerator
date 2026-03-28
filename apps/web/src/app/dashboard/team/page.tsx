import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users2, TrendingUp, MessageSquare, Clock, Shield } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getOrgData(token: string) {
  const [mineRes] = await Promise.all([
    fetch(`${API_URL}/api/organizations/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ]);
  if (!mineRes.ok) return null;
  return mineRes.json();
}

async function getMembers(token: string, orgId: string) {
  const res = await fetch(`${API_URL}/api/organizations/${orgId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  owner:  { label: 'Owner',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  admin:  { label: 'Admin',  bg: 'bg-indigo-50',   text: 'text-indigo-700' },
  member: { label: 'Membro', bg: 'bg-gray-100',    text: 'text-gray-600' },
};

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  annual:  'Anual',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  trial:     { label: 'Trial ativo',    color: 'text-amber-600 bg-amber-50' },
  active:    { label: 'Ativo',          color: 'text-brand-600 bg-brand-50' },
  cancelled: { label: 'Cancelado',      color: 'text-red-600 bg-red-50' },
  past_due:  { label: 'Pagamento em falta', color: 'text-red-600 bg-red-50' },
};

function avatarColor(name: string) {
  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-brand-100 text-brand-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

function AdherenceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">—</span>;
  const color = score >= 7 ? 'bg-brand-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(score / 10) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700">{score}/10</span>
    </div>
  );
}

export default async function TeamPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const orgData = await getOrgData(session.access_token);
  if (!orgData) redirect('/create-organization');

  const { role, organizations: org } = orgData;

  // Only admin/owner can see full team view
  if (role === 'member') redirect('/dashboard');

  const members = await getMembers(session.access_token, org.id);
  const activeMembers = members.filter((m: any) => m.joined_at);
  const pendingInvites = members.filter((m: any) => !m.joined_at);

  const totalClients = activeMembers.reduce((sum: number, m: any) => sum + (m.client_count ?? 0), 0);
  const adherenceScores = activeMembers
    .map((m: any) => m.avg_adherence)
    .filter((s: any): s is number => s !== null);
  const teamAdherence = adherenceScores.length
    ? Math.round((adherenceScores.reduce((a: number, b: number) => a + b, 0) / adherenceScores.length) * 10) / 10
    : null;

  const statusCfg = STATUS_CONFIG[org.subscription_status] ?? STATUS_CONFIG.active;
  const trialDaysLeft = org.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Shield size={13} />
              Enterprise · {BILLING_LABELS[org.billing_interval]}
            </span>
            <span>·</span>
            <span>{org.max_members} licenças</span>
            {org.subscription_status === 'trial' && trialDaysLeft !== null && (
              <>
                <span>·</span>
                <span className="text-amber-600 flex items-center gap-1">
                  <Clock size={12} />
                  {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''} de trial restante{trialDaysLeft !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        <Link
          href="/dashboard/team/members"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
        >
          <Users2 size={15} />
          Gerir membros
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Membros ativos',  value: activeMembers.length,
            sub: `${pendingInvites.length} convite${pendingInvites.length !== 1 ? 's' : ''} pendente${pendingInvites.length !== 1 ? 's' : ''}`,
            icon: <Users2 size={18} className="text-indigo-600" />, bg: 'bg-indigo-50' },
          { label: 'Total de clientes', value: totalClients,
            sub: `${org.max_members - activeMembers.length} licença${org.max_members - activeMembers.length !== 1 ? 's' : ''} disponível${org.max_members - activeMembers.length !== 1 ? 'is' : ''}`,
            icon: <Users2 size={18} className="text-brand-600" />, bg: 'bg-brand-50' },
          { label: 'Adesão média equipa', value: teamAdherence !== null ? `${teamAdherence}/10` : '—',
            sub: 'últimos 7 dias',
            icon: <TrendingUp size={18} className="text-purple-600" />, bg: 'bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`${stat.bg} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Membros da equipa</h2>
          <Link href="/dashboard/team/members" className="text-sm text-indigo-600 hover:text-indigo-800 transition">
            Gerir →
          </Link>
        </div>

        {activeMembers.length === 0 ? (
          <div className="py-12 text-center">
            <Users2 size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">Ainda não tens membros na equipa.</p>
            <Link
              href="/dashboard/team/members"
              className="inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Convidar primeiro membro
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeMembers.map((member: any) => {
              const rc = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
              const initials = (member.full_name ?? member.invited_email ?? '?')
                .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
              const avColor = avatarColor(member.full_name ?? member.invited_email ?? 'X');

              return (
                <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avColor}`}>
                    {initials}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {member.full_name ?? member.invited_email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{member.invited_email}</p>
                  </div>

                  {/* Role */}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rc.bg} ${rc.text}`}>
                    {rc.label}
                  </span>

                  {/* Clients */}
                  <div className="text-right min-w-[60px]">
                    <p className="text-sm font-bold text-gray-900">{member.client_count ?? 0}</p>
                    <p className="text-xs text-gray-400">clientes</p>
                  </div>

                  {/* Adherence */}
                  <div className="min-w-[100px]">
                    <AdherenceBar score={member.avg_adherence} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 mt-4">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              Convites pendentes
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {pendingInvites.length}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingInvites.map((invite: any) => {
              const rc = ROLE_CONFIG[invite.role] ?? ROLE_CONFIG.member;
              return (
                <div key={invite.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm shrink-0">
                    ?
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 truncate">{invite.invited_email}</p>
                    <p className="text-xs text-gray-400">Convite enviado · aguarda aceitação</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rc.bg} ${rc.text}`}>
                    {rc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
