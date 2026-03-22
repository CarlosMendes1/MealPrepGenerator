import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-brand-700">NutriDesk</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
            Entrar
          </Link>
          <Link
            href="/register"
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition"
          >
            Começar grátis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 py-24 text-center">
        <span className="inline-block bg-brand-100 text-brand-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Ferramenta para nutricionistas
        </span>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Dê feedback a todos os seus clientes
          <br />
          <span className="text-brand-600">em metade do tempo</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          A IA analisa as fotos das refeições dos seus clientes, identifica os alimentos, calcula macros
          e gera um rascunho de feedback. Você revê, edita e envia — em segundos.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-brand-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-brand-700 transition"
          >
            Experimentar 14 dias grátis
          </Link>
          <Link
            href="#how-it-works"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-50 transition"
          >
            Como funciona
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-24">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Cliente fotografa a refeição',
                desc: 'O cliente usa a app NutriDesk para fotografar cada refeição do dia, diretamente do telemóvel.',
              },
              {
                step: '2',
                title: 'IA analisa e gera rascunho',
                desc: 'A inteligência artificial identifica os alimentos, estima as porções, calcula macros e cria um rascunho de feedback personalizado.',
              },
              {
                step: '3',
                title: 'Nutricionista revê e envia',
                desc: 'No painel web, vê todos os clientes, revê o rascunho da IA, edita se necessário e envia o feedback em segundos.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 max-w-5xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Planos simples</h2>
        <p className="text-center text-gray-500 mb-16">Sem surpresas. Cancele quando quiser.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {[
            {
              name: 'Starter',
              price: '29',
              desc: 'Para nutricionistas a começar',
              features: ['Até 15 clientes', 'Análise IA de refeições', 'Feedback draft automático', 'App mobile para clientes', 'Suporte por email'],
              highlight: false,
            },
            {
              name: 'Pro',
              price: '59',
              desc: 'Para consultórios em crescimento',
              features: ['Clientes ilimitados', 'Tudo do Starter', 'Resumo diário automático', 'Exportar relatórios PDF', 'Suporte prioritário'],
              highlight: true,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 ${plan.highlight ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200'}`}
            >
              <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-6 ${plan.highlight ? 'text-brand-100' : 'text-gray-500'}`}>{plan.desc}</p>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>€{plan.price}</span>
                <span className={`text-sm ml-1 ${plan.highlight ? 'text-brand-100' : 'text-gray-500'}`}>/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm flex items-center gap-2 ${plan.highlight ? 'text-brand-100' : 'text-gray-600'}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${plan.highlight ? 'bg-white text-brand-600' : 'bg-brand-100 text-brand-700'}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`block text-center py-3 rounded-lg font-medium transition ${
                  plan.highlight
                    ? 'bg-white text-brand-600 hover:bg-brand-50'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                Começar agora
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} NutriDesk. Todos os direitos reservados.
      </footer>
    </main>
  );
}
