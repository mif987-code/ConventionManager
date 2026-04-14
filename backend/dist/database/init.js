"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function initDatabase() {
    console.log('[DB] Initializing database schema...');
    try {
        const schemaPath = path_1.default.join(__dirname, '../../sql/schema.sql');
        const schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
        await db_1.pool.query(schema);
        console.log('[DB] Schema created successfully');
    }
    catch (err) {
        console.error('[DB] Schema initialization failed:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
initDatabase();
//# sourceMappingURL=init.js.map