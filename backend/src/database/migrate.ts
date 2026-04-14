import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    const migrations = [
      'migration_001_swiss.sql',
      'migration_002_prize_templates.sql',
      'migrations/001_add_preregistration_fields.sql',
    ];

    for (const file of migrations) {
      console.log(`[Migrate] Running ${file}...`);
      const migrationPath = path.join(__dirname, '../../sql', file);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      console.log(`[Migrate] ${file} applied successfully`);
    }
  } catch (err) {
    console.error('[Migrate] Error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
