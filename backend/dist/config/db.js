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
// PostgreSQL NUMERIC (OID 1700) is returned as a string by node-pg to avoid precision loss.
// Our NUMERIC columns (entry costs, ledger amounts) are used arithmetically as JS numbers,
// so parse them as floats app-wide instead of handling this per-query.
pg_1.types.setTypeParser(1700, (val) => parseFloat(val));
function requireEnv(key, fallback) {
    const val = process.env[key] ?? fallback;
    if (!val) {
        console.error(`[DB] Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return val;
}
const dbHost = requireEnv('DB_HOST', 'localhost');
const isLocalHost = dbHost === 'localhost' || dbHost === '127.0.0.1';
exports.pool = new pg_1.Pool({
    user: requireEnv('DB_USER', 'postgres'),
    host: dbHost,
    database: requireEnv('DB_NAME', 'convention_manager'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT', '5432'), 10),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // Managed Postgres providers (Render, etc.) require SSL and use certificates
    // not in Node's default CA store; local development doesn't need/support it.
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
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