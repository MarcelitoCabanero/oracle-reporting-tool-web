import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bomRouter } from './modules/bom/bom.routes.js';
import { rofRouter } from './modules/rof/rof.routes.js';
import { depositRouter } from './modules/deposit/deposit.routes.js';
import { menuItemRouter } from './modules/menuitem/menuitem.routes.js';
import { systemSalesRouter } from './modules/systemsales/systemsales.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  cors({
    origin:
      env.nodeEnv === 'production' || env.clientOrigin === '*'
        ? true
        : env.clientOrigin,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api', (_request, response) => {
  response.json({ name: 'Oracle Reporting Tool API', version: '0.1.0' });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/reports/bom', bomRouter);
app.use('/api/reports/rof', rofRouter);
app.use('/api/reports/deposit', depositRouter);
app.use('/api/reports/menu-item', menuItemRouter);
app.use('/api/reports/system-sales', systemSalesRouter);

// Serve built frontend static assets in production / Docker
const clientDistCandidates = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
];

const clientDistPath = clientDistCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'index.html'))
);

if (clientDistPath) {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});
