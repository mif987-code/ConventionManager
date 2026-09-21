"use strict";
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
exports.regenerateQRCode = regenerateQRCode;
exports.activateUser = activateUser;
exports.deactivateUser = deactivateUser;
exports.deleteUser = deleteUser;
exports.searchDeletedUsersWithPayments = searchDeletedUsersWithPayments;
const db_1 = require("../config/db");
const transactionService_1 = require("./transactionService");
const walletService_1 = require("./walletService");
const attendanceService_1 = require("./attendanceService");
const qr_1 = require("../utils/qr");
async function createUser(name, nfcUid, email, isAdmin = false, conventionId, attendanceDates) {
    const result = await db_1.pool.query(`INSERT INTO users (name, nfc_uid, email, is_admin, convention_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [name, nfcUid ?? null, email ?? null, isAdmin, conventionId ?? null]);
    const user = result.rows[0];
    if (attendanceDates && attendanceDates.length > 0 && conventionId) {
        await (0, attendanceService_1.setUserAttendance)(user.id, conventionId, attendanceDates);
    }
    user.qr_code = await (0, qr_1.issueQRCode)(user.id);
    return user;
}
async function getUserByNfcUid(nfcUid, conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE nfc_uid = $1 AND convention_id = $2 AND deleted_at IS NULL`
        : `SELECT * FROM users WHERE nfc_uid = $1 AND deleted_at IS NULL`;
    const params = conventionId ? [nfcUid, conventionId] : [nfcUid];
    const result = await db_1.pool.query(query, params);
    return result.rows[0] ?? null;
}
async function getUserByQrCode(qrCode, conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE qr_code = $1 AND convention_id = $2 AND deleted_at IS NULL`
        : `SELECT * FROM users WHERE qr_code = $1 AND deleted_at IS NULL`;
    const params = conventionId ? [qrCode, conventionId] : [qrCode];
    const result = await db_1.pool.query(query, params);
    return result.rows[0] ?? null;
}
async function getUserById(id) {
    const result = await db_1.pool.query(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return result.rows[0] ?? null;
}
async function getAllUsers(conventionId) {
    const query = conventionId
        ? `SELECT * FROM users WHERE convention_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`
        : `SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    const params = conventionId ? [conventionId] : [];
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
async function getUserWithBalances(userId, conventionId) {
    const user = await getUserById(userId);
    if (!user)
        return null;
    const [voucherBalance, tixBalance, creditBalance] = await Promise.all([
        (0, transactionService_1.getBalance)(userId, 'voucher'),
        (0, transactionService_1.getBalance)(userId, 'tix'),
        (0, walletService_1.getBalance)(userId, conventionId ?? user.convention_id),
    ]);
    return { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance, credit_balance: creditBalance };
}
async function getUserByNfcUidWithBalances(nfcUid, conventionId) {
    const user = await getUserByNfcUid(nfcUid);
    if (!user)
        return null;
    const [voucherBalance, tixBalance, creditBalance] = await Promise.all([
        (0, transactionService_1.getBalance)(user.id, 'voucher'),
        (0, transactionService_1.getBalance)(user.id, 'tix'),
        (0, walletService_1.getBalance)(user.id, conventionId ?? user.convention_id),
    ]);
    return { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance, credit_balance: creditBalance };
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
    setClauses.push('updated_at = NOW()');
    values.push(id);
    const result = await db_1.pool.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    return result.rows[0] ?? null;
}
async function searchUsers(query, conventionId) {
    const q = `%${query}%`;
    const result = conventionId
        ? await db_1.pool.query(`SELECT * FROM users WHERE convention_id = $1 AND deleted_at IS NULL AND (name ILIKE $2 OR last_name ILIKE $2 OR nfc_uid ILIKE $2 OR email ILIKE $2) ORDER BY name`, [conventionId, q])
        : await db_1.pool.query(`SELECT * FROM users WHERE deleted_at IS NULL AND (name ILIKE $1 OR last_name ILIKE $1 OR nfc_uid ILIKE $1 OR email ILIKE $1) ORDER BY name`, [q]);
    return result.rows;
}
async function regenerateQRCode(userId) {
    const user = await getUserById(userId);
    if (!user)
        throw new Error('User not found');
    user.qr_code = await (0, qr_1.issueQRCode)(userId);
    return user;
}
async function activateUser(userId, adminId) {
    const result = await db_1.pool.query(`UPDATE users SET is_active = TRUE, activated_at = NOW(), activated_by = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`, [adminId, userId]);
    return result.rows[0] ?? null;
}
async function deactivateUser(userId) {
    const result = await db_1.pool.query(`UPDATE users SET is_active = FALSE, activated_at = NULL, activated_by = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`, [userId]);
    return result.rows[0] ?? null;
}
async function deleteUser(userId, deletedBy) {
    const paid = await db_1.pool.query(`SELECT 1 FROM payments
     WHERE user_id = $1 AND status = 'paid' AND COALESCE(provider, CASE WHEN id LIKE 'mock_%' THEN 'mock' ELSE 'legacy' END) <> 'mock'
     LIMIT 1`, [userId]);
    if (paid.rows.length > 0)
        return { deleted: false, hasRealPayment: true };
    const result = await db_1.pool.query(`UPDATE users
     SET deleted_at = NOW(), deleted_by = $2, deletion_reason = 'admin_deleted', is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`, [userId, deletedBy]);
    return { deleted: (result.rowCount ?? 0) > 0, hasRealPayment: false };
}
async function searchDeletedUsersWithPayments(query, conventionId) {
    const q = `%${query}%`;
    const params = conventionId ? [conventionId, q] : [q];
    const conventionFilter = conventionId ? 'AND u.convention_id = $1' : '';
    const queryParam = conventionId ? '$2' : '$1';
    const result = await db_1.pool.query(`SELECT u.*, COUNT(p.id)::int AS payment_count,
            COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS paid_total,
            MAX(p.created_at) AS last_payment_at
     FROM users u
     LEFT JOIN payments p ON p.user_id = u.id
     WHERE u.deleted_at IS NOT NULL ${conventionFilter}
       AND (u.name ILIKE ${queryParam} OR u.last_name ILIKE ${queryParam} OR u.email ILIKE ${queryParam})
     GROUP BY u.id
     ORDER BY u.deleted_at DESC`, params);
    return result.rows;
}
//# sourceMappingURL=userService.js.map