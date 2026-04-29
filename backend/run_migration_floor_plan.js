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
    await client.query(`
      CREATE TABLE IF NOT EXISTS floor_plans (
        id SERIAL PRIMARY KEY,
        convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(convention_id)
      );`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS floor_plan_tables (
        id SERIAL PRIMARY KEY,
        convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
        table_number VARCHAR(20) NOT NULL,
        x FLOAT NOT NULL, y FLOAT NOT NULL,
        w FLOAT NOT NULL, h FLOAT NOT NULL,
        area_id INTEGER, area_name VARCHAR(100), area_color VARCHAR(20),
        UNIQUE(convention_id, table_number)
      );`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS table_reservations (
        id SERIAL PRIMARY KEY,
        table_id INTEGER REFERENCES floor_plan_tables(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        convention_id INTEGER REFERENCES conventions(id) ON DELETE CASCADE,
        reserved_by INTEGER,
        reserved_at TIMESTAMP DEFAULT NOW(),
        released_at TIMESTAMP
      );`);
    await client.query(`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS table_id INTEGER REFERENCES floor_plan_tables(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);`);
    await client.query('COMMIT');
    console.log('Floor plan migration complete');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message); process.exit(1);
  } finally { client.release(); pool.end(); }
}
migrate();
