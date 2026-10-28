import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, env.host, () => {
  console.log(`Oracle Reporting API listening on http://${env.host}:${env.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down API...`);
  server.close((error) => {
    if (error) {
      console.error('Error while shutting down:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
