import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust candidate paths for .env (handles running from repo root or server package root)
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port value: ${value}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.API_HOST ?? '0.0.0.0',
  port: readPort(process.env.API_PORT, 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  jwtSecret: process.env.JWT_SECRET ?? 'oracle_reporting_secret_key_change_in_production_2026',

  sql: {
    server: process.env.SQL_SERVER_HOST ?? '192.168.5.201',
    port: readPort(process.env.SQL_SERVER_PORT, 1433),
    database: process.env.SQL_SERVER_DATABASE ?? 'OracleDB',
    user: process.env.SQL_SERVER_USER ?? 'oracle_web_reporting',
    password: process.env.SQL_SERVER_PASSWORD ?? '',
    options: {
      encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQL_SERVER_TRUST_SERVER_CERTIFICATE !== 'false',
      enableArithAbort: true,
      connectTimeout: 15000,
      requestTimeout: 60000,
    },
    pool: {
      max: 15,
      min: 1,
      idleTimeoutMillis: 30000,
    },
  },

  ftp: {
    host: process.env.FTP_HOST?.trim() ?? 'ftp.cfi.com.ph',
    user: process.env.FTP_USER?.trim() ?? 'cfiftp@cfi.com.ph',
    password: process.env.FTP_PASSWORD?.trim() ?? '',
    secure: process.env.FTP_SECURE === 'true',
  },
};
