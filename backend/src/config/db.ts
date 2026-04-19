import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) {
    console.error(`[DB] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

export const pool = new Pool({
  user: requireEnv('DB_USER', 'postgres'),
  host: requireEnv('DB_HOST', 'localhost'),
  database: requireEnv('DB_NAME', 'convention_manager'),
  password: requireEnv('DB_PASSWORD'),
  port: parseInt(requireEnv('DB_PORT', '5432'), 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
  process.exit(-1);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('[DB] PostgreSQL connected successfully');
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    return false;
  }
}
