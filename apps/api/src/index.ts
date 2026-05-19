import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger.js';

// ── Fail fast on missing required config ──────────────────────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import profileRouter from './routes/profile.js';
import clientsRouter from './routes/clients.js';
import mealsRouter from './routes/meals.js';
import dashboardRouter from './routes/dashboard.js';
import organizationsRouter from './routes/organizations.js';
import consultationsRouter from './routes/consultations.js';
import billingRouter, { billingWebhookHandler } from './routes/billing.js';
import coachRouter from './routes/coach.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Trust proxy (nginx / cloud load balancers) ─────────────────────────────
// Required for rate limiting to see real client IPs, not the proxy IP.
app.set('trust proxy', 1);

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
// Explicit allowlist — no wildcard in production.
const ALLOWED_ORIGINS: string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests with no Origin header (same-origin, server-to-server).
      // Reject in production; allow in development.
      if (!origin) {
        IS_PROD ? callback(new Error('Origin required')) : callback(null, true);
        return;
      }
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);

// ── Stripe webhook — must receive raw body BEFORE json middleware ─────────
// Stripe uses the raw Buffer to verify the signature.
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler,
);

// ── Body parsing with strict size limits ──────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────
// Global: 200 req / 15 min per IP.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// AI endpoints are expensive — tighter limit: 30 req / 15 min per IP.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please try again later.' },
});

// Coach chat uses Opus 4.6 — most expensive model. Extra tight: 15 req / 15 min.
const coachLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many coach requests. Please slow down.' },
});

app.use(globalLimiter);

// ── Health check (unauthenticated, no rate limit side-effect) ─────────────
app.get('/health',  (_req, res) => res.json({ status: 'ok', service: 'nutridesk-api', ts: Date.now() }));
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'nutridesk-api', ts: Date.now() }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/profile', profileRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/meals', aiLimiter, mealsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/coach', coachLimiter, coachRouter);

// ── Global error handler — never leak stack traces to clients ─────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = crypto.randomUUID();
  logger.error(err.message, { requestId, stack: IS_PROD ? undefined : err.stack });
  res.status(500).json({ error: 'Internal server error', requestId });
});

const server = app.listen(PORT, () => {
  logger.info(`NutriDesk API running on port ${PORT}`, { env: IS_PROD ? 'production' : 'development' });
});

function shutdown(signal: string) {
  logger.info(`${signal} received — closing server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Shutdown timeout — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
