# NutriDesk

**Plataforma B2B de acompanhamento nutricional com inteligência artificial.**

Ferramenta que permite a nutricionistas acompanhar todos os seus clientes de forma eficiente: os clientes fotografam as suas refeições, a IA analisa automaticamente e gera um rascunho de feedback, e o nutricionista revê e envia em segundos.

---

## Como funciona

```
Cliente fotografa refeição
        ↓
API recebe foto → Claude Vision analisa
        ↓
Identifica alimentos + estima macros + gera rascunho de feedback
        ↓
Nutricionista revê no painel web → edita (opcional) → envia
        ↓
Cliente recebe feedback na app
```

---

## Estrutura do projeto

```
nutridesk/
├── apps/
│   ├── api/          # Node.js + Express + TypeScript — API REST
│   ├── web/          # Next.js 14 — Painel do nutricionista
│   └── mobile/       # Expo (React Native) — App do cliente
├── supabase/
│   └── migrations/   # Schema SQL (PostgreSQL via Supabase)
├── .env.example      # Variáveis de ambiente necessárias
└── package.json      # Monorepo (npm workspaces)
```

---

## Stack tecnológico

| Componente | Tecnologia |
|---|---|
| API backend | Node.js + Express + TypeScript |
| Web (nutricionista) | Next.js 14 (App Router) + Tailwind CSS |
| Mobile (cliente) | Expo + React Native + NativeWind |
| Base de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth |
| Armazenamento de fotos | Supabase Storage |
| IA — análise de refeições | Claude API (claude-sonnet-4-6 com visão) |
| Pagamentos (futuro) | Stripe |

---

## Setup rápido

### Pré-requisitos

- Node.js 20+
- Conta Supabase: [supabase.com](https://supabase.com)
- Conta Anthropic: [console.anthropic.com](https://console.anthropic.com)

### 1. Clonar e instalar dependências

```bash
git clone <repo>
cd nutridesk
npm install
```

### 2. Configurar Supabase

1. Cria um novo projeto em [app.supabase.com](https://app.supabase.com)
2. No SQL Editor, executa o ficheiro `supabase/migrations/001_initial_schema.sql`
3. Cria o bucket `meal-photos` em Storage (ou deixa o script SQL criar)

### 3. Variáveis de ambiente

```bash
# API
cp .env.example apps/api/.env
# Preenche SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# Web
cp .env.example apps/web/.env.local
# Preenches NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

# Mobile — edita apps/mobile/app.json (extra.supabaseUrl, extra.supabaseAnonKey)
# e cria apps/mobile/.env com EXPO_PUBLIC_API_URL
```

### 4. Iniciar em desenvolvimento

```bash
# API (porta 3001)
npm run dev:api

# Web (porta 3000)
npm run dev:web

# Mobile
npm run dev:mobile
```

---

## Funcionalidades do MVP

### Painel do Nutricionista (Web)
- [x] Registo e login
- [x] Dashboard com resumo de clientes
- [x] Lista de clientes com métricas
- [x] Geração de códigos de convite
- [x] Página de cliente com feed de refeições
- [x] Análise automática por IA (alimentos, macros, score de adesão)
- [x] Editor de feedback com rascunho da IA
- [x] Envio de feedback aprovado ao cliente

### App do Cliente (Mobile)
- [x] Registo e login
- [x] Onboarding (dados corporais, objetivo, código do nutricionista)
- [x] Dashboard diário (calorias, proteína, refeições)
- [x] Captura/upload de foto de refeição
- [x] Visualização de feedback do nutricionista
- [x] Histórico de refeições com análise
- [x] Perfil e atualização de métricas

### API
- [x] Análise de fotos com Claude Vision
- [x] Gestão de clientes com convites
- [x] Autenticação via Supabase
- [x] Row Level Security (RLS)
- [x] Geração de resumo diário por IA

---

## Modelo de negócio (B2B SaaS)

| Plano | Preço | Clientes |
|---|---|---|
| Starter | €29/mês | Até 15 clientes |
| Pro | €59/mês | Ilimitados |

**Métricas alvo:**
- 100 nutricionistas × €45 ARPU = **€4.500 MRR** (~€54k ARR)
- 500 nutricionistas = **€22.500 MRR** (~€270k ARR)

---

## Próximos passos

- [ ] Notificações push (novo feedback, lembrete de refeição)
- [ ] Exportação de relatórios PDF (semanal/mensal por cliente)
- [ ] Integração Stripe para pagamentos
- [ ] Gráficos de progresso (peso, macros ao longo do tempo)
- [ ] Templates de feedback rápido para nutricionistas
- [ ] Suporte multi-idioma (PT, ES, EN)

---

## Licença

MIT