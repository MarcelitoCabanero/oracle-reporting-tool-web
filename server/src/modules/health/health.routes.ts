import { Router } from 'express';
import { testConnection } from '../../database/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  const dbHealth = await testConnection();

  response.status(200).json({
    status: 'ok',
    service: 'oracle-reporting-api',
    database: dbHealth.connected ? 'connected' : 'disconnected',
    databaseError: dbHealth.message,
    timestamp: new Date().toISOString(),
  });
});
