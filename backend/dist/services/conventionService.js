"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConventions = listConventions;
exports.createConvention = createConvention;
exports.getConvention = getConvention;
exports.updateConvention = updateConvention;
exports.endConvention = endConvention;
exports.getConventionStats = getConventionStats;
exports.exportConvention = exportConvention;
exports.deleteConvention = deleteConvention;
const db_1 = require("../config/db");
// List all conventions
async function listConventions() {
    const result = await db_1.pool.query('SELECT id, name, status, created_at, ended_at FROM conventions ORDER BY created_at DESC');
    return { conventions: result.rows };
}
// Create a new convention
async function createConvention(name) {
    const result = await db_1.pool.query('INSERT INTO conventions (name, status) VALUES ($1, $2) RETURNING *', [name, 'active']);
    return result.rows[0];
}
// Get convention by ID
async function getConvention(id) {
    const result = await db_1.pool.query('SELECT id, name, status, created_at, ended_at, scan_mode FROM conventions WHERE id = $1', [id]);
    return result.rows[0] || null;
}
// Update convention
async function updateConvention(id, fields) {
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (fields.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(fields.name);
    }
    if (fields.scan_mode !== undefined) {
        updates.push(`scan_mode = $${paramIndex++}`);
        values.push(fields.scan_mode);
    }
    if (updates.length === 0)
        return await getConvention(id);
    values.push(id);
    const result = await db_1.pool.query(`UPDATE conventions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    return result.rows[0] || null;
}
// End a convention (lock it)
async function endConvention(id) {
    const result = await db_1.pool.query('UPDATE conventions SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', ['ended', id]);
    return result.rows[0];
}
// Get comprehensive statistics for a convention
async function getConventionStats(id) {
    // Player count and names
    const playersResult = await db_1.pool.query('SELECT id, name FROM users WHERE convention_id = $1', [id]);
    // Total events
    const eventsResult = await db_1.pool.query('SELECT COUNT(*) as count FROM events WHERE convention_id = $1', [id]);
    // Event types breakdown
    const eventTypesResult = await db_1.pool.query(`SELECT et.name as type, COUNT(e.id) as count
     FROM events e
     JOIN event_types et ON e.event_type_id = et.id
     WHERE e.convention_id = $1
     GROUP BY et.name`, [id]);
    // Events with player counts
    const eventsPlayerCountResult = await db_1.pool.query(`SELECT e.id, e.name, COUNT(ep.id) as player_count
     FROM events e
     LEFT JOIN event_participants ep ON e.id = ep.event_id
     WHERE e.convention_id = $1
     GROUP BY e.id, e.name`, [id]);
    // Total Tix awarded (from transactions - positive tix transactions)
    const tixAwardedResult = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE convention_id = $1 AND type = 'tix' AND amount > 0`, [id]);
    // Total Tix used (from store orders)
    const tixUsedResult = await db_1.pool.query(`SELECT COALESCE(SUM(total_tix), 0) as total
     FROM store_orders
     WHERE convention_id = $1 AND status IN ('confirmed', 'fulfilled')`, [id]);
    // Tix used by product
    const tixByProductResult = await db_1.pool.query(`SELECT si.name as product_name, COALESCE(SUM(soi.quantity), 0) * si.price_tix as tix_used
     FROM store_orders so
     JOIN store_order_items soi ON so.id = soi.order_id
     JOIN store_items si ON soi.item_id = si.id
     WHERE so.convention_id = $1 AND so.status IN ('confirmed', 'fulfilled')
     GROUP BY si.name`, [id]);
    // Products sold in real currency
    const currencySalesResult = await db_1.pool.query(`SELECT si.name as product_name, COALESCE(SUM(soi.quantity * si.cost), 0) as total_sales
     FROM store_orders so
     JOIN store_order_items soi ON so.id = soi.order_id
     JOIN store_items si ON soi.item_id = si.id
     WHERE so.convention_id = $1 AND so.status IN ('confirmed', 'fulfilled') AND si.cost > 0
     GROUP BY si.name`, [id]);
    // Purchases: Tix vs Currency
    const purchasesResult = await db_1.pool.query(`SELECT 
       COALESCE(SUM(CASE WHEN payment_method = 'tix' THEN 1 ELSE 0 END), 0) as tix_purchases,
       COALESCE(SUM(CASE WHEN payment_method IN ('cash', 'card') THEN 1 ELSE 0 END), 0) as currency_purchases
     FROM store_orders
     WHERE convention_id = $1 AND status IN ('confirmed', 'fulfilled')`, [id]);
    // Vouchers sold (positive voucher transactions) and remaining balance
    const vouchersSoldResult = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0) as total_vouchers
     FROM transactions
     WHERE convention_id = $1 AND type = 'voucher' AND amount > 0`, [id]);
    // Vouchers used (negative voucher transactions for event entry)
    const vouchersUsedResult = await db_1.pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0) as total_used
     FROM transactions
     WHERE convention_id = $1 AND type = 'voucher' AND amount < 0`, [id]);
    return {
        player_count: playersResult.rows.length,
        player_names: playersResult.rows.map((p) => p.name),
        total_events: parseInt(eventsResult.rows[0].count),
        event_types_breakdown: eventTypesResult.rows,
        events_player_counts: eventsPlayerCountResult.rows,
        total_tix_awarded: parseInt(tixAwardedResult.rows[0].total),
        total_tix_used: parseInt(tixUsedResult.rows[0].total),
        tix_by_product: tixByProductResult.rows,
        products_sold_currency: currencySalesResult.rows,
        purchases_tix_vs_currency: [
            {
                tix_purchases: parseInt(purchasesResult.rows[0].tix_purchases),
                currency_purchases: parseInt(purchasesResult.rows[0].currency_purchases),
            }
        ],
        vouchers_sold: parseInt(vouchersSoldResult.rows[0].total_vouchers),
        vouchers_unused: parseInt(vouchersSoldResult.rows[0].total_vouchers) - parseInt(vouchersUsedResult.rows[0].total_used),
    };
}
// Export convention data as JSON
async function exportConvention(id) {
    const stats = await getConventionStats(id);
    const convention = await getConvention(id);
    return {
        convention,
        stats,
        exported_at: new Date().toISOString(),
    };
}
// Delete a convention and all its data
async function deleteConvention(id) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Delete in order respecting foreign keys
        await client.query('DELETE FROM event_matches WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM event_rounds WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM event_participants WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM events WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM event_types WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE convention_id = $1)', [id]);
        await client.query('DELETE FROM store_orders WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM store_items WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM transactions WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM users WHERE convention_id = $1', [id]);
        await client.query('DELETE FROM conventions WHERE id = $1', [id]);
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=conventionService.js.map