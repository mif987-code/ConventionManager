"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Legacy top-level migration files (predate the numbered sql/migrations/ folder).
// migration_003_rls.sql is intentionally excluded — it requires manually creating
// a dedicated `app_user` DB role first (see the file's header comment) and is not
// safe to run automatically.
const LEGACY_MIGRATIONS = [
    'migration_001_swiss.sql',
    'migration_002_prize_templates.sql',
];
// Postgres error codes that indicate "this object already exists" — safe to treat
// as already-applied when a migration was previously run by hand outside this
// tracking table (several older migration files create indexes/triggers without
// IF NOT EXISTS guards, so a raw re-run would otherwise fail).
const ALREADY_EXISTS_CODES = new Set(['42701', '42710', '42P07', '42P16', '42723']);
async function ensureMigrationsTable() {
    await db_1.pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
async function runMigrationFile(filePath, key) {
    const sql = fs_1.default.readFileSync(filePath, 'utf-8');
    try {
        await db_1.pool.query(sql);
        console.log(`[Migrate] Applied ${key}`);
    }
    catch (err) {
        if (ALREADY_EXISTS_CODES.has(err.code)) {
            console.warn(`[Migrate] ${key} looks already applied (${err.code}: ${err.message}) — marking as applied and continuing.`);
        }
        else {
            throw err;
        }
    }
    await db_1.pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, [key]);
}
async function migrate() {
    try {
        await ensureMigrationsTable();
        const appliedRes = await db_1.pool.query('SELECT filename FROM schema_migrations');
        const applied = new Set(appliedRes.rows.map((r) => r.filename));
        for (const file of LEGACY_MIGRATIONS) {
            if (applied.has(file))
                continue;
            await runMigrationFile(path_1.default.join(__dirname, '../../sql', file), file);
        }
        const migrationsDir = path_1.default.join(__dirname, '../../sql/migrations');
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        for (const file of files) {
            const key = `migrations/${file}`;
            if (applied.has(key))
                continue;
            await runMigrationFile(path_1.default.join(migrationsDir, file), key);
        }
        console.log('[Migrate] All migrations up to date.');
    }
    catch (err) {
        console.error('[Migrate] Error:', err);
        process.exitCode = 1;
    }
    finally {
        await db_1.pool.end();
    }
}
migrate();
//# sourceMappingURL=migrate.js.map