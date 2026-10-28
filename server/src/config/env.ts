import 'dotenv/config';

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
};
