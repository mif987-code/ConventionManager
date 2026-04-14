import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

async function initDatabase() {
  console.log('[DB] Initializing database schema...');

  try {
    const schemaPath = path.join(__dirname, '../../sql/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);
    console.log('[DB] Schema created successfully');
  } catch (err) {
    console.error('[DB] Schema initialization failed:', err);
  } finally {
    await pool.end();
  }
}

initDatabase();
