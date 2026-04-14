"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function migrate() {
    try {
        const migrations = [
            'migration_001_swiss.sql',
            'migration_002_prize_templates.sql',
            'migrations/001_add_preregistration_fields.sql',
        ];
        for (const file of migrations) {
            console.log(`[Migrate] Running ${file}...`);
            const migrationPath = path_1.default.join(__dirname, '../../sql', file);
            const sql = fs_1.default.readFileSync(migrationPath, 'utf-8');
            await db_1.pool.query(sql);
            console.log(`[Migrate] ${file} applied successfully`);
        }
    }
    catch (err) {
        console.error('[Migrate] Error:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
migrate();
//# sourceMappingURL=migrate.js.map