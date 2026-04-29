const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'convention_manager',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10)
});
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id)`);
    await client.query('COMMIT');
    console.log('Migration 018 complete: is_active, activated_at, activated_by added to users');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message); process.exit(1);
  } finally { client.release(); pool.end(); }
}
migrate();
