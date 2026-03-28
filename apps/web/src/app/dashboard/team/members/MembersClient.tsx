'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { UserPlus, Copy, Check, X, ChevronDown, Trash2, ArrowLeft, Mail } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  owner:  { label: 'Owner',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  admin:  { label: 'Admin',  bg: 'bg-indigo-50',   text: 'text-indigo-700', border: 'border-indigo-200' },
  member: { label: 'Membro', bg: 'bg-gray-100',    text: 'text-gray-600',   border: 'border-gray-200' },
};

function avatarColor(name: string) {
  const colors = ['bg-indigo-100 text-indigo-700', 'bg-violet-100 text-violet-700', 'bg-brand-100 text-brand-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

interface Member {
  id: string;
  user_id: string | null;
  role: string;
  invited_email: string;
  full_name: string | null;
  joined_at: string | null;
  client_count: number;
  avg_adherence: number | null;
}

interface Props {
  org: { id: string; name: string; max_members: number };
  members: Member[];
  currentUserId: string;
  userRole: string;
  token: string;
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ orgId, token, onClose, onSuccess }: {
  orgId: string; token: string;
  onClose: () => void; onSuccess: (url: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao convidar.'); return; }
      onSuccess(`${window.location.origin}/accept-invitation/${data.token}`, email.trim());
    } catch {
      setError('Erro de ligação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Convidar membro</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="nutricionista@clinica.com"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['member', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    role === r ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {r === 'member' ? 'Membro' : 'Admin'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r === 'member'
                      ? 'Vê apenas os seus clientes'
                      : 'Vê todos os clientes da equipa'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={send}
            disabled={loading || !email.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {loading ? 'A enviar...' : 'Gerar link de convite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invite link result ────────────────────────────────────────────────────────

function InviteLinkCard({ url, email, onClose }: { url: string; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Convite criado</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Partilha este link com <span className="font-semibold">{email}</span>. Expira em 7 dias.
        </p>

        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 break-all font-mono mb-4 border border-gray-200">
          {url}
        </div>

        <button
          onClick={copy}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition ${
            copied ? 'bg-brand-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {copied ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar link</>}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MembersClient({ org, members: initialMembers, currentUserId, userRole, token }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ url: string; email: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.joined_at);
  const pendingInvites = members.filter((m) => !m.joined_at);

  async function removeMember(memberId: string) {
    if (!confirm('Remover este membro da equipa?')) return;
    setRemoving(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organizations/${org.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setRemoving(null);
    }
  }

  async function changeRole(memberId: string, role: 'admin' | 'member') {
    setUpdatingRole(memberId);
    try {
      const res = await fetch(`${API_URL}/api/organizations/${org.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
      }
    } finally {
      setUpdatingRole(null);
    }
  }

  function handleInviteSuccess(url: string, email: string) {
    setShowInvite(false);
    setInviteLink({ url, email });
    // Refresh members list (pending invite added)
    fetch(`${API_URL}/api/organizations/${org.id}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setMembers)
      .catch(() => {});
  }

  const spotsLeft = org.max_members - activeMembers.length;

  return (
    <>
      {showInvite && (
        <InviteModal
          orgId={org.id} token={token}
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
      {inviteLink && (
        <InviteLinkCard
          url={inviteLink.url} email={inviteLink.email}
          onClose={() => setInviteLink(null)}
        />
      )}

      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/team" className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {activeMembers.length}/{org.max_members} licenças usadas
              {spotsLeft > 0 && (
                <span className="text-brand-600 ml-1">· {spotsLeft} disponíve{spotsLeft === 1 ? 'l' : 'is'}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            disabled={spotsLeft <= 0}
            className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <UserPlus size={15} />
            Convidar membro
          </button>
        </div>

        {/* Active members */}
        <div className="bg-white rounded-2xl border border-gray-100 mb-4">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Membros ativos</h2>
          </div>

          {activeMembers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-400 text-sm">Ainda não tens membros. Convida o primeiro!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeMembers.map((member) => {
                const rc = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
                const initials = (member.full_name ?? member.invited_email)
                  .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                const avColor = avatarColor(member.full_name ?? member.invited_email);
                const isMe = member.user_id === currentUserId;
                const isOwner = member.role === 'owner';

                return (
                  <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avColor}`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {member.full_name ?? member.invited_email}
                        </p>
                        {isMe && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                            Tu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.invited_email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role badge / selector */}
                      {isOwner || isMe ? (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rc.bg} ${rc.text} ${rc.border}`}>
                          {rc.label}
                        </span>
                      ) : (
                        <div className="relative">
                          <select
                            value={member.role}
                            disabled={updatingRole === member.id}
                            onChange={(e) => changeRole(member.id, e.target.value as 'admin' | 'member')}
                            className={`appearance-none text-xs font-semibold px-2.5 py-1 pr-6 rounded-full border cursor-pointer ${rc.bg} ${rc.text} ${rc.border} focus:outline-none`}
                          >
                            <option value="member">Membro</option>
                            <option value="admin">Admin</option>
                          </select>
                          <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${rc.text}`} />
                        </div>
                      )}

                      {/* Stats */}
                      <div className="text-right min-w-[52px]">
                        <p className="text-sm font-bold text-gray-900">{member.client_count ?? 0}</p>
                        <p className="text-xs text-gray-400">clientes</p>
                      </div>

                      {/* Remove */}
                      {!isOwner && !isMe && (
                        <button
                          onClick={() => removeMember(member.id)}
                          disabled={removing === member.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-1"
                          title="Remover membro"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Convites pendentes</h2>
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                {pendingInvites.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingInvites.map((invite) => {
                const rc = ROLE_CONFIG[invite.role] ?? ROLE_CONFIG.member;
                return (
                  <div key={invite.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm shrink-0 border-2 border-dashed border-gray-200">
                      ?
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{invite.invited_email}</p>
                      <p className="text-xs text-amber-600">A aguardar aceitação</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rc.bg} ${rc.text} ${rc.border}`}>
                      {rc.label}
                    </span>
                    <button
                      onClick={() => removeMember(invite.id)}
                      disabled={removing === invite.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Cancelar convite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
