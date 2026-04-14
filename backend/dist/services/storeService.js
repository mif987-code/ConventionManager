"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.getItemById = getItemById;
exports.getAllItems = getAllItems;
exports.purchaseItem = purchaseItem;
exports.reserveItem = reserveItem;
exports.fulfillOrder = fulfillOrder;
exports.cancelOrder = cancelOrder;
exports.getOrders = getOrders;
exports.getUserOrders = getUserOrders;
const db_1 = require("../config/db");
const transactionService_1 = require("./transactionService");
// --- Items CRUD ---
async function createItem(name, description, priceTix, stock, imageUrl) {
    const result = await db_1.pool.query(`INSERT INTO store_items (name, description, price_tix, stock, image_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`, [name, description, priceTix, stock, imageUrl]);
    return result.rows[0];
}
async function updateItem(id, fields) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (fields.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(fields.name);
    }
    if (fields.description !== undefined) {
        sets.push(`description = $${idx++}`);
        params.push(fields.description);
    }
    if (fields.price_tix !== undefined) {
        sets.push(`price_tix = $${idx++}`);
        params.push(fields.price_tix);
    }
    if (fields.stock !== undefined) {
        sets.push(`stock = $${idx++}`);
        params.push(fields.stock);
    }
    if (fields.image_url !== undefined) {
        sets.push(`image_url = $${idx++}`);
        params.push(fields.image_url);
    }
    if (fields.active !== undefined) {
        sets.push(`active = $${idx++}`);
        params.push(fields.active);
    }
    if (sets.length === 0)
        throw new Error('No fields to update');
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await db_1.pool.query(`UPDATE store_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0)
        throw new Error('Item not found');
    return result.rows[0];
}
async function deleteItem(id) {
    const result = await db_1.pool.query(`DELETE FROM store_items WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0)
        throw new Error('Item not found');
}
async function getItemById(id) {
    const result = await db_1.pool.query(`SELECT * FROM store_items WHERE id = $1`, [id]);
    return result.rows[0] || null;
}
async function getAllItems(activeOnly = false) {
    const query = activeOnly
        ? `SELECT * FROM store_items WHERE active = TRUE ORDER BY name`
        : `SELECT * FROM store_items ORDER BY name`;
    const result = await db_1.pool.query(query);
    return result.rows;
}
// --- Orders ---
async function purchaseItem(userId, itemId, quantity = 1) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query(`SELECT * FROM store_items WHERE id = $1 AND active = TRUE FOR UPDATE`, [itemId]);
        const item = itemRes.rows[0];
        if (!item)
            throw new Error('Item not found or inactive');
        if (item.stock < quantity)
            throw new Error(`Not enough stock. Available: ${item.stock}`);
        const totalTix = item.price_tix * quantity;
        const balance = await (0, transactionService_1.getBalance)(userId, 'tix', client);
        if (balance < totalTix)
            throw new Error(`Not enough tix. Need ${totalTix}, have ${balance}`);
        // Deduct tix
        await (0, transactionService_1.addTransaction)({
            userId,
            type: 'tix',
            amount: -totalTix,
            reason: 'purchase',
            createdBy: 'store',
            client,
        });
        // Reduce stock
        await client.query(`UPDATE store_items SET stock = stock - $2, updated_at = NOW() WHERE id = $1`, [itemId, quantity]);
        // Create order
        const orderRes = await client.query(`INSERT INTO store_orders (user_id, item_id, quantity, total_tix, status, order_type)
       VALUES ($1, $2, $3, $4, 'confirmed', 'purchase') RETURNING *`, [userId, itemId, quantity, totalTix]);
        await client.query('COMMIT');
        return { success: true, order: orderRes.rows[0], new_balance: balance - totalTix };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function reserveItem(userId, itemId, quantity = 1) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query(`SELECT * FROM store_items WHERE id = $1 AND active = TRUE FOR UPDATE`, [itemId]);
        const item = itemRes.rows[0];
        if (!item)
            throw new Error('Item not found or inactive');
        if (item.stock < quantity)
            throw new Error(`Not enough stock. Available: ${item.stock}`);
        const totalTix = item.price_tix * quantity;
        // Reserve stock (reduce it) but don't charge tix yet
        await client.query(`UPDATE store_items SET stock = stock - $2, updated_at = NOW() WHERE id = $1`, [itemId, quantity]);
        // Create reservation order
        const orderRes = await client.query(`INSERT INTO store_orders (user_id, item_id, quantity, total_tix, status, order_type)
       VALUES ($1, $2, $3, $4, 'reserved', 'reserve') RETURNING *`, [userId, itemId, quantity, totalTix]);
        await client.query('COMMIT');
        return { success: true, order: orderRes.rows[0] };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function fulfillOrder(orderId, adminNote) {
    const result = await db_1.pool.query(`UPDATE store_orders SET status = 'fulfilled', admin_note = COALESCE($2, admin_note), updated_at = NOW()
     WHERE id = $1 AND status IN ('confirmed', 'reserved') RETURNING *`, [orderId, adminNote || null]);
    if (result.rows.length === 0)
        throw new Error('Order not found or already fulfilled/cancelled');
    return result.rows[0];
}
async function cancelOrder(orderId) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const orderRes = await client.query(`SELECT * FROM store_orders WHERE id = $1 FOR UPDATE`, [orderId]);
        const order = orderRes.rows[0];
        if (!order)
            throw new Error('Order not found');
        if (order.status === 'fulfilled' || order.status === 'cancelled') {
            throw new Error('Order already fulfilled or cancelled');
        }
        // Restore stock
        await client.query(`UPDATE store_items SET stock = stock + $2, updated_at = NOW() WHERE id = $1`, [order.item_id, order.quantity]);
        // Refund tix if it was a purchase
        if (order.order_type === 'purchase' && order.status === 'confirmed') {
            await (0, transactionService_1.addTransaction)({
                userId: order.user_id,
                type: 'tix',
                amount: order.total_tix,
                reason: 'refund',
                createdBy: 'store_cancel',
                client,
            });
        }
        await client.query(`UPDATE store_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [orderId]);
        await client.query('COMMIT');
        return { success: true };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function getOrders(filters = {}) {
    let query = `SELECT so.*, si.name AS item_name, u.name AS user_name, u.last_name AS user_last_name
               FROM store_orders so
               JOIN store_items si ON so.item_id = si.id
               JOIN users u ON so.user_id = u.id`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filters.status) {
        conditions.push(`so.status = $${idx++}`);
        params.push(filters.status);
    }
    if (filters.userId) {
        conditions.push(`so.user_id = $${idx++}`);
        params.push(filters.userId);
    }
    if (conditions.length)
        query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY so.created_at DESC`;
    if (filters.limit) {
        query += ` LIMIT $${idx++}`;
        params.push(filters.limit);
    }
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
async function getUserOrders(userId) {
    return getOrders({ userId });
}
//# sourceMappingURL=storeService.js.map