import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, AlertCircle } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import AcceptButton from './AcceptButton';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getInvite(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/organizations/invitations/${token}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  admin:  'Administrador',
  member: 'Membro',
};

export default async function AcceptInvitationPage({ params }: { params: { token: string } }) {
  const invite = await getInvite(params.token);

  if (!invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Convite inválido</h1>
          <p className="text-gray-500 text-sm mb-6">
            Este link pode ter expirado ou já foi utilizado.
          </p>
          <Link
            href="/login"
            className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  const { supabase, user } = await getAuthenticatedUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full">
        {/* Org logo placeholder */}
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Users size={28} className="text-indigo-600" />
        </div>

        <div className="text-center mb-8">
          <p className="text-sm text-gray-400 mb-1">Foste convidado para</p>
          <h1 className="text-2xl font-bold text-gray-900">{invite.organizations?.name}</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              invite.role === 'admin'
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {ROLE_LABELS[invite.role] ?? invite.role}
            </span>
          </div>
        </div>

        {user ? (
          <AcceptButton token={params.token} orgName={invite.organizations?.name} />
        ) : (
          <div className="space-y-3">
            <Link
              href={`/login?redirect=/accept-invitation/${params.token}`}
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold py-3 rounded-xl transition"
            >
              Entrar na conta
            </Link>
            <Link
              href={`/register?invite=${params.token}&email=${encodeURIComponent(invite.invited_email)}`}
              className="block w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-center font-semibold py-3 rounded-xl transition text-sm"
            >
              Criar nova conta
            </Link>
            <p className="text-center text-xs text-gray-400">
              Convite enviado para{' '}
              <span className="font-medium text-gray-600">{invite.invited_email}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
