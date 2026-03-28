'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface Props {
  token: string;
  orgName: string;
}

export default function AcceptButton({ token, orgName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/organizations/invitations/${token}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erro ao aceitar o convite.');
        return;
      }

      router.push('/dashboard/team');
    } catch {
      setError('Erro de ligação. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>
      )}
      <button
        onClick={accept}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition"
      >
        {loading ? 'A aceitar...' : `Juntar à equipa`}
      </button>
      <p className="text-center text-xs text-gray-400">
        Ao aceitar, passarás a ter acesso aos clientes da organização.
      </p>
    </div>
  );
}
