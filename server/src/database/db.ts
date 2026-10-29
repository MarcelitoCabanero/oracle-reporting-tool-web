import sql from 'mssql';
import { env } from '../config/env.js';

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = (async () => {
    try {
      const newPool = new sql.ConnectionPool(env.sql);
      newPool.on('error', (err) => {
        console.error('SQL Server pool background error:', err.message);
      });

      await newPool.connect();
      pool = newPool;
      console.log(`Connected to SQL Server: ${env.sql.server}:${env.sql.port}/${env.sql.database}`);
      return newPool;
    } catch (error) {
      poolPromise = null;
      console.error('Failed to connect to SQL Server:', (error as Error).message);
      throw error;
    }
  })();

  return poolPromise;
}

export async function testConnection(): Promise<{ connected: boolean; message?: string }> {
  try {
    const activePool = await getPool();
    const result = await activePool.request().query('SELECT 1 AS status');
    if (result.recordset[0]?.status === 1) {
      return { connected: true };
    }
    return { connected: false, message: 'Unexpected query response' };
  } catch (error) {
    return { connected: false, message: (error as Error).message };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      poolPromise = null;
      console.log('SQL Server pool closed gracefully.');
    } catch (err) {
      console.error('Error closing SQL Server pool:', (err as Error).message);
    }
  }
}

export { sql };
