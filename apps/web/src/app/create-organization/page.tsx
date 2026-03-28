'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Check, Zap, Shield, TrendingUp, ChevronRight, Minus, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const PRICE_MONTHLY = 15;
const PRICE_ANNUAL_PER_MONTH = 12;

const FEATURES = [
  'Clientes partilhados com a equipa',
  'Visão global de todos os nutricionistas',
  'Gestão de roles e permissões',
  'Estatísticas por membro',
  'Convites por link',
  'Suporte prioritário',
];

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [seats, setSeats] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pricePerSeat = billing === 'annual' ? PRICE_ANNUAL_PER_MONTH : PRICE_MONTHLY;
  const totalMonthly = pricePerSeat * seats;
  const totalAnnual = totalMonthly * (billing === 'annual' ? 12 : 1);
  const savingsVsMonthly = billing === 'annual'
    ? (PRICE_MONTHLY * seats * 12) - (PRICE_ANNUAL_PER_MONTH * seats * 12)
    : 0;

  async function handleCreate() {
    if (!orgName.trim()) return;
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: orgName.trim(), billing_interval: billing, max_members: seats }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erro ao criar organização.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-brand-700">NutriDesk</Link>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 transition">
          Voltar ao dashboard
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-8 pb-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Zap size={12} />
            Enterprise
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Cria a tua equipa
          </h1>
          <p className="text-gray-500 text-lg max-w-md mx-auto">
            Centraliza a gestão da tua clínica. Convida nutricionistas, acompanha todos os clientes e analisa o desempenho da equipa.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left: form */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-8">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > s ? 'bg-brand-600 text-white' :
                    step === s ? 'bg-indigo-600 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step > s ? <Check size={13} /> : s}
                  </div>
                  <span className={`text-sm font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s === 1 ? 'Organização' : 'Plano'}
                  </span>
                  {s < 2 && <ChevronRight size={14} className="text-gray-300 ml-1" />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da organização
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && orgName.trim()) setStep(2); }}
                    placeholder="ex: Clínica NutriVida"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Será visível para todos os membros da equipa.
                  </p>
                </div>

                <button
                  onClick={() => orgName.trim() && setStep(2)}
                  disabled={!orgName.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {/* Billing toggle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Faturação
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['monthly', 'annual'] as const).map((b) => (
                      <button
                        key={b}
                        onClick={() => setBilling(b)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          billing === b
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {b === 'annual' && (
                          <span className="absolute -top-2.5 right-3 bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            -20%
                          </span>
                        )}
                        <p className="font-semibold text-gray-900 text-sm">
                          {b === 'monthly' ? 'Mensal' : 'Anual'}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          €{b === 'monthly' ? PRICE_MONTHLY : PRICE_ANNUAL_PER_MONTH}
                          <span className="text-sm font-normal text-gray-400">/lic/mês</span>
                        </p>
                        {b === 'annual' && (
                          <p className="text-xs text-brand-600 font-medium mt-1">
                            Faturado anualmente
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seat counter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Número de licenças
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSeats(Math.max(2, seats - 1))}
                      className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-2xl font-bold text-gray-900 w-8 text-center">{seats}</span>
                    <button
                      onClick={() => setSeats(Math.min(200, seats + 1))}
                      className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-sm text-gray-500">nutricionistas</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Mínimo 2 licenças. Podes alterar a qualquer momento.</p>
                </div>

                {/* Price summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {seats} licença{seats !== 1 ? 's' : ''} × €{pricePerSeat}/mês
                    </span>
                    <span className="font-semibold text-gray-900">€{totalMonthly}/mês</span>
                  </div>
                  {billing === 'annual' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total anual</span>
                        <span className="font-semibold text-gray-900">€{totalAnnual}/ano</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                        <span className="text-brand-600 font-medium">Poupança vs mensal</span>
                        <span className="text-brand-600 font-bold">€{savingsVsMonthly}/ano</span>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-xs text-gray-400 text-center">
                  14 dias de trial gratuito. Sem cartão de crédito necessário agora.
                </p>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {loading ? 'A criar...' : 'Criar equipa'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: features */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Users size={16} className="text-indigo-600" />
                </div>
                <p className="font-semibold text-gray-900">O que está incluído</p>
              </div>
              <ul className="space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Check size={15} className="text-brand-600 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-indigo-600 rounded-2xl p-6 text-white">
              <Shield size={20} className="mb-3 opacity-80" />
              <p className="font-semibold mb-1">Trial de 14 dias</p>
              <p className="text-indigo-200 text-sm leading-relaxed">
                Testa todas as funcionalidades sem compromisso. Sem cartão de crédito necessário para começar.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <TrendingUp size={18} className="text-brand-600 mb-3" />
              <p className="font-semibold text-gray-900 mb-1">Métricas de equipa</p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Acompanha a adesão média, feedback pendente e performance de cada membro da tua clínica.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
