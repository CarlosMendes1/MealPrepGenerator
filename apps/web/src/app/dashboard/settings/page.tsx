import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap, Users2, ExternalLink } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import SettingsForm from './SettingsForm';
import BillingButton from './BillingButton';
import BillingToast from './BillingToast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

const INDIVIDUAL_PLANS = [
  {
    key: 'free',
    name: 'Gratuito',
    price: 0,
    period: '',
    features: ['Até 5 clientes', 'Análise IA por refeição', 'Feedback básico'],
    cta: 'Plano atual',
    ctaDisabled: true,
  },
  {
    key: 'monthly',
    name: 'Pro Mensal',
    price: 19,
    period: '/mês',
    features: ['Clientes ilimitados', 'Análise IA por refeição', 'Feedback avançado', 'Histórico completo', 'Suporte prioritário'],
    cta: 'Ativar agora',
    highlight: false,
  },
  {
    key: 'annual',
    name: 'Pro Anual',
    price: 190,
    period: '/ano',
    sub: '≈ €15.83/mês',
    save: '-17%',
    features: ['Clientes ilimitados', 'Análise IA por refeição', 'Feedback avançado', 'Histórico completo', 'Suporte prioritário'],
    cta: 'Ativar agora',
    highlight: true,
  },
] as const;

export default async function SettingsPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, role, goal, individual_plan, stripe_subscription_id, created_at')
    .eq('user_id', user.id)
    .single();

  const orgContext = await getOrgContext(session.access_token);
  const currentPlan = profile?.individual_plan ?? 'free';

  return (
    <div className="p-8 max-w-3xl">
      <BillingToast />
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Definições</h1>

      {/* Profile form */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Perfil</h2>
        <SettingsForm profile={profile} token={session.access_token} />
      </section>

      {/* Plans section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Plano individual</h2>
          {orgContext && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <Users2 size={11} />
              Na equipa {orgContext.organizations?.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {INDIVIDUAL_PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            return (
              <div
                key={plan.key}
                className={`relative bg-white rounded-2xl border-2 p-5 flex flex-col transition-all ${
                  plan.highlight
                    ? 'border-brand-400 shadow-sm'
                    : isCurrent
                    ? 'border-gray-900'
                    : 'border-gray-100'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Recomendado
                  </span>
                )}
                {'save' in plan && plan.save && (
                  <span className="absolute top-3 right-3 bg-brand-50 text-brand-700 text-xs font-bold px-1.5 py-0.5 rounded-md">
                    {plan.save}
                  </span>
                )}

                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-gray-900">€{plan.price}</span>
                    <span className="text-xs text-gray-400">{plan.period}</span>
                  </div>
                  {'sub' in plan && plan.sub && (
                    <p className="text-xs text-gray-400 mt-0.5">{plan.sub}</p>
                  )}
                </div>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check size={12} className="text-brand-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.key === 'free' || isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500 cursor-default"
                  >
                    {isCurrent ? 'Plano atual' : plan.cta}
                  </button>
                ) : (
                  <BillingButton
                    plan={plan.key === 'monthly' ? 'pro_monthly' : 'pro_annual'}
                    token={session.access_token}
                    label={plan.cta}
                    highlight={!!plan.highlight}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Team upsell or manage */}
        {orgContext ? (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users2 size={16} className="text-indigo-600" />
                <p className="font-semibold text-gray-900 text-sm">Equipa: {orgContext.organizations?.name}</p>
              </div>
              <p className="text-xs text-gray-500">
                {orgContext.role === 'owner'
                  ? 'Geres a faturação da tua equipa nas definições da organização.'
                  : 'A faturação é gerida pelo owner da tua equipa.'}
              </p>
            </div>
            {orgContext.role === 'owner' && (
              <Link
                href="/dashboard/team"
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                Gerir equipa
                <ExternalLink size={11} />
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-indigo-600" />
                <p className="font-semibold text-gray-900 text-sm">Tens uma clínica ou equipa?</p>
              </div>
              <p className="text-xs text-gray-500">
                €12/licença/mês no plano anual. Trial de 14 dias gratuito.
              </p>
            </div>
            <Link
              href="/create-organization"
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition whitespace-nowrap"
            >
              <Users2 size={13} />
              Criar equipa
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
