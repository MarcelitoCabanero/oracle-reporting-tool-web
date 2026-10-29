import { app } from './app.js';
import { env } from './config/env.js';
import { closePool } from './database/db.js';

const server = app.listen(env.port, env.host, () => {
  console.log(`Oracle Reporting API listening on http://${env.host}:${env.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down API...`);
  await closePool();
  server.close((error) => {
    if (error) {
      console.error('Error while shutting down server:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
