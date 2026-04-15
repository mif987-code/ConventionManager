const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const sql = require('fs').readFileSync('./sql/migrations/006_conventions_system.sql', 'utf8');
    await client.query(sql);
    console.log('Migration 006 completed successfully');
  } catch (err) {
    console.error('Migration 006 failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
