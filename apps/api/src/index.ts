import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import profileRouter from './routes/profile.js';
import clientsRouter from './routes/clients.js';
import mealsRouter from './routes/meals.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nutridesk-api', timestamp: new Date().toISOString() });
});

app.use('/api/profile', profileRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/meals', mealsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🥗 NutriDesk API running on http://localhost:${PORT}`);
});

export default app;
