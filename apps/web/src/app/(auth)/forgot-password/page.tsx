'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (authError) {
      setError('Não foi possível enviar o email. Verifica o endereço e tenta novamente.');
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="mb-8">
          <Link href="/" className="text-xl font-bold text-brand-700">NutriDesk</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Recuperar palavra-passe</h1>
          <p className="text-gray-500 text-sm">
            Envia-te um link para criares uma nova palavra-passe.
          </p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-4 text-sm text-green-700 mb-6">
            <p className="font-semibold mb-1">Email enviado!</p>
            <p>Verifica a tua caixa de entrada e segue o link para redefinir a palavra-passe.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="nutricionista@email.com"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-60"
            >
              {loading ? 'A enviar...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
