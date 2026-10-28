import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api', (_request, response) => {
  response.json({ name: 'Oracle Reporting Tool API', version: '0.1.0' });
});

app.use('/api/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});
