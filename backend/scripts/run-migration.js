const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

// Create pool using environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'convention_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function runMigration(migrationFile) {
  const filePath = path.join(__dirname, '../sql/migrations', migrationFile);
  
  console.log(`Running migration: ${migrationFile}`);
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Connect to database
    const client = await pool.connect();
    
    try {
      // Execute the migration
      await client.query(sql);
      console.log(`✅ Migration ${migrationFile} completed successfully`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  console.error('Example: node scripts/run-migration.js 010_special_vouchers.sql');
  process.exit(1);
}

runMigration(migrationFile);
