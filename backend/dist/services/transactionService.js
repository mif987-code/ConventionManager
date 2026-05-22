"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTransaction = addTransaction;
exports.getBalance = getBalance;
exports.getTransactionHistory = getTransactionHistory;
const db_1 = require("../config/db");
// All balance changes go through this single ledger insert.
async function addTransaction(params) {
    const { userId, type, amount, reason, eventId, createdBy, client, conventionId, paymentLink } = params;
    const executor = client ?? db_1.pool;
    const result = await executor.query(`INSERT INTO transactions (user_id, type, amount, reason, event_id, created_by, convention_id, payment_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`, [userId, type, amount, reason, eventId ?? null, createdBy, conventionId ?? null, paymentLink ?? null]);
    return result.rows[0].id;
}
// Balance is always computed from the ledger — never stored.
async function getBalance(userId, type, client, conventionId) {
    const executor = client ?? db_1.pool;
    const query = conventionId
        ? `SELECT COALESCE(SUM(amount), 0)::int AS balance FROM transactions WHERE user_id = $1 AND type = $2 AND convention_id = $3`
        : `SELECT COALESCE(SUM(amount), 0)::int AS balance FROM transactions WHERE user_id = $1 AND type = $2`;
    const params = conventionId
        ? [userId, type, conventionId]
        : [userId, type];
    const result = await executor.query(query, params);
    return result.rows[0].balance;
}
async function getTransactionHistory(userId, type, limit = 50, offset = 0) {
    const params = [userId];
    let query = `SELECT t.*, e.name AS event_name
               FROM transactions t
               LEFT JOIN events e ON t.event_id = e.id
               WHERE t.user_id = $1`;
    if (type) {
        query += ` AND t.type = $2`;
        params.push(type);
    }
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
//# sourceMappingURL=transactionService.js.map