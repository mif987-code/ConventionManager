"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function seed() {
    console.log('[Seed] Running database seed...');
    try {
        // First run schema
        const schemaPath = path_1.default.join(__dirname, '../../sql/schema.sql');
        const schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
        await db_1.pool.query(schema);
        console.log('[Seed] Schema applied');
        // Insert sample event types with categories and W/L-based prize structures
        await db_1.pool.query(`
      INSERT INTO event_types (name, category, format, entry_cost_vouchers, max_players, prize_structure)
      VALUES
        ('Draft', 'Draft', NULL, 15, 8, '{"3-0": 100, "2-1": 50, "1-2": 10, "0-3": 0}'),
        ('Sealed', 'Sealed', NULL, 25, 8, '{"3-0": 150, "2-1": 75, "1-2": 15, "0-3": 0}'),
        ('Constructed - Standard', 'Constructed', 'Standard', 5, 16, '{"4-0": 80, "3-1": 40, "2-2": 10, "1-3": 0, "0-4": 0}'),
        ('Constructed - Modern', 'Constructed', 'Modern', 5, 16, '{"4-0": 80, "3-1": 40, "2-2": 10, "1-3": 0, "0-4": 0}'),
        ('Constructed - Pioneer', 'Constructed', 'Pioneer', 5, 16, '{"4-0": 80, "3-1": 40, "2-2": 10, "1-3": 0, "0-4": 0}'),
        ('Constructed - PreModern', 'Constructed', 'PreModern', 5, 16, '{"4-0": 80, "3-1": 40, "2-2": 10, "1-3": 0, "0-4": 0}'),
        ('Commander', 'Commander', NULL, 3, 4, '{"1st": 40, "2nd": 20, "3rd": 10, "4th": 0}')
      ON CONFLICT DO NOTHING
    `);
        console.log('[Seed] Event types created');
        // Insert sample admin user
        await db_1.pool.query(`
      INSERT INTO users (name, nfc_uid, email, is_admin)
      VALUES ('Admin', 'ADMIN_NFC_001', 'admin@convention.local', true)
      ON CONFLICT (nfc_uid) DO NOTHING
    `);
        console.log('[Seed] Admin user created');
        // Insert sample players
        await db_1.pool.query(`
      INSERT INTO users (name, nfc_uid, email)
      VALUES
        ('Player One', 'NFC_PLAYER_001', 'player1@test.com'),
        ('Player Two', 'NFC_PLAYER_002', 'player2@test.com'),
        ('Player Three', 'NFC_PLAYER_003', 'player3@test.com'),
        ('Player Four', 'NFC_PLAYER_004', 'player4@test.com')
      ON CONFLICT (nfc_uid) DO NOTHING
    `);
        console.log('[Seed] Sample players created');
        // Give players some vouchers
        const players = await db_1.pool.query(`SELECT id FROM users WHERE NOT is_admin`);
        for (const p of players.rows) {
            await db_1.pool.query(`
        INSERT INTO transactions (user_id, type, amount, reason, created_by)
        VALUES ($1, 'voucher', 50, 'topup', 'seed')
      `, [p.id]);
        }
        console.log('[Seed] Initial vouchers distributed');
        console.log('[Seed] Done!');
    }
    catch (err) {
        console.error('[Seed] Error:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
seed();
//# sourceMappingURL=seed.js.map