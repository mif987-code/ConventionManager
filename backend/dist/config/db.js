"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.testConnection = testConnection;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(key, fallback) {
    const val = process.env[key] ?? fallback;
    if (!val) {
        console.error(`[DB] Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return val;
}
exports.pool = new pg_1.Pool({
    user: requireEnv('DB_USER', 'postgres'),
    host: requireEnv('DB_HOST', 'localhost'),
    database: requireEnv('DB_NAME', 'convention_manager'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT', '5432'), 10),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
    process.exit(-1);
});
async function testConnection() {
    try {
        const client = await exports.pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('[DB] PostgreSQL connected successfully');
        return true;
    }
    catch (err) {
        console.error('[DB] Connection failed:', err);
        return false;
    }
}
//# sourceMappingURL=db.js.map