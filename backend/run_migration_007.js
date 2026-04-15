const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('[Migration] Connecting to database...');
    await pool.connect();
    console.log('[Migration] Connected');

    const sql = fs.readFileSync('./sql/migrations/007_cost_decimal.sql', 'utf8');
    console.log('[Migration] Running migration 007...');
    await pool.query(sql);
    console.log('[Migration] Migration 007 completed successfully');
  } catch (err) {
    console.error('[Migration] Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
