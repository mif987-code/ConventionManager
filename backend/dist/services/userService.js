"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.getUserByNfcUid = getUserByNfcUid;
exports.getUserByQrCode = getUserByQrCode;
exports.getUserById = getUserById;
exports.getAllUsers = getAllUsers;
exports.getUserWithBalances = getUserWithBalances;
exports.getUserByNfcUidWithBalances = getUserByNfcUidWithBalances;
exports.updateUser = updateUser;
exports.searchUsers = searchUsers;
const db_1 = require("../config/db");
const transactionService_1 = require("./transactionService");
const qrcode_1 = __importDefault(require("qrcode"));
async function createUser(name, nfcUid, email, isAdmin = false, conventionId) {
    const result = await db_1.pool.query(`INSERT INTO users (name, nfc_uid, email, is_admin, convention_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [name, nfcUid || null, email || null, isAdmin, conventionId || null]);
    const user = result.rows[0];
    // Generate QR code for the user
    const qrData = JSON.stringify({ userId: user.id, name: user.name });
    const qrCode = await qrcode_1.default.toDataURL(qrData);
    // Update user with QR code
    await db_1.pool.query(`UPDATE users SET qr_code = $1 WHERE id = $2`, [qrCode, user.id]);
    user.qr_code = qrCode;
    return user;
}
async function getUserByNfcUid(nfcUid, conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE nfc_uid = $1 AND convention_id = $2`
        : `SELECT * FROM users WHERE nfc_uid = $1`;
    const params = conventionId ? [nfcUid, conventionId] : [nfcUid];
    const result = await db_1.pool.query(query, params);
    return result.rows[0] || null;
}
async function getUserByQrCode(qrCode, conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE qr_code = $1 AND convention_id = $2`
        : `SELECT * FROM users WHERE qr_code = $1`;
    const params = conventionId ? [qrCode, conventionId] : [qrCode];
    const result = await db_1.pool.query(query, params);
    return result.rows[0] || null;
}
async function getUserById(id) {
    const result = await db_1.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return result.rows[0] || null;
}
async function getAllUsers(conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE convention_id = $1 ORDER BY created_at DESC`
        : `SELECT * FROM users ORDER BY created_at DESC`;
    const params = conventionId ? [conventionId] : [];
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
async function getUserWithBalances(userId) {
    const user = await getUserById(userId);
    if (!user)
        return null;
    const voucherBalance = await (0, transactionService_1.getBalance)(userId, 'voucher');
    const tixBalance = await (0, transactionService_1.getBalance)(userId, 'tix');
    return {
        ...user,
        voucher_balance: voucherBalance,
        tix_balance: tixBalance,
    };
}
async function getUserByNfcUidWithBalances(nfcUid) {
    const user = await getUserByNfcUid(nfcUid);
    if (!user)
        return null;
    const voucherBalance = await (0, transactionService_1.getBalance)(user.id, 'voucher');
    const tixBalance = await (0, transactionService_1.getBalance)(user.id, 'tix');
    return {
        ...user,
        voucher_balance: voucherBalance,
        tix_balance: tixBalance,
    };
}
async function updateUser(id, fields) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    if (fields.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(fields.name);
    }
    if (fields.nfc_uid !== undefined) {
        setClauses.push(`nfc_uid = $${paramIndex++}`);
        values.push(fields.nfc_uid);
    }
    if (fields.email !== undefined) {
        setClauses.push(`email = $${paramIndex++}`);
        values.push(fields.email);
    }
    if (fields.days_playing !== undefined) {
        setClauses.push(`days_playing = $${paramIndex++}`);
        values.push(fields.days_playing);
    }
    if (fields.is_admin !== undefined) {
        setClauses.push(`is_admin = $${paramIndex++}`);
        values.push(fields.is_admin);
    }
    if (setClauses.length === 0)
        return null;
    setClauses.push(`updated_at = NOW()`);
    values.push(id);
    const result = await db_1.pool.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    return result.rows[0] || null;
}
async function searchUsers(query) {
    const result = await db_1.pool.query(`SELECT * FROM users WHERE name ILIKE $1 OR last_name ILIKE $1 OR nfc_uid ILIKE $1 OR email ILIKE $1 ORDER BY name`, [`%${query}%`]);
    return result.rows;
}
//# sourceMappingURL=userService.js.map