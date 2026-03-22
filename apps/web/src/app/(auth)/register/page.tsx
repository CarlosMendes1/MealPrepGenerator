'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !data.session) {
      setError(authError?.message ?? 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
      return;
    }

    // Create profile as nutritionist
    try {
      await api.post(
        '/api/profile',
        { full_name: form.name, role: 'nutritionist' },
        data.session.access_token
      );
    } catch {
      // Profile creation via trigger on Supabase; error here is non-fatal
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="mb-8">
          <Link href="/" className="text-xl font-bold text-brand-700">NutriDesk</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Criar conta gratuita</h1>
          <p className="text-gray-500 text-sm">14 dias grátis, sem cartão de crédito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              value={form.name}
              onChange={update('name')}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Dra. Ana Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email profissional</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="ana.silva@clinica.pt"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-passe</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Mínimo 8 caracteres"
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
            {loading ? 'A criar conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Ao criar conta, aceita os nossos{' '}
          <span className="text-brand-600 cursor-pointer hover:underline">Termos de Serviço</span>{' '}
          e{' '}
          <span className="text-brand-600 cursor-pointer hover:underline">Política de Privacidade</span>.
        </p>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
