"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = getStats;
const db_1 = require("../config/db");
async function getStats(conventionId) {
    // 1. Amount of players registered & Names of the players
    const totalPlayers = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE convention_id = $1`, [conventionId]);
    const playerNames = await db_1.pool.query(`SELECT id, name, email FROM users WHERE convention_id = $1 ORDER BY name`, [conventionId]);
    // 2. Total number of events that were run
    const totalEvents = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE convention_id = $1`, [conventionId]);
    // 3a. Breakdown of what types of events
    const eventTypeBreakdown = await db_1.pool.query(`SELECT et.category, et.name as type_name, COUNT(e.id)::int as event_count
     FROM event_types et
     LEFT JOIN events e ON et.id = e.event_type_id AND e.convention_id = $1
     WHERE et.convention_id = $1
     GROUP BY et.category, et.name
     ORDER BY et.category, et.name`, [conventionId]);
    // 3b. How many players played on each event
    const playersPerEvent = await db_1.pool.query(`SELECT e.id, e.name, COUNT(ep.user_id)::int as player_count
     FROM events e
     LEFT JOIN event_participants ep ON e.id = ep.event_id
     WHERE e.convention_id = $1
     GROUP BY e.id, e.name
     ORDER BY e.name`, [conventionId]);
    // 4. Total Tix awarded vs Total Tix used
    const tixAwarded = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM transactions 
     WHERE type = 'tix' AND amount > 0 AND convention_id = $1`, [conventionId]);
    const tixUsed = await db_1.pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0)::int AS total
     FROM transactions 
     WHERE type = 'tix' AND amount < 0 AND convention_id = $1`, [conventionId]);
    // 4a. In what products were Tix used
    const tixUsageByProduct = await db_1.pool.query(`SELECT si.name as product_name, COUNT(so.id)::int as order_count, 
            COALESCE(SUM(so.total_tix), 0)::int as total_tix_spent
     FROM store_orders so
     JOIN store_items si ON so.item_id = si.id
     WHERE so.order_type = 'purchase' AND so.status != 'cancelled' 
       AND so.convention_id = $1
     GROUP BY si.name
     ORDER BY total_tix_spent DESC`, [conventionId]);
    // 5. Products sold in real currency
    const realCurrencySales = await db_1.pool.query(`SELECT si.name as product_name, COUNT(so.id)::int as order_count,
            COALESCE(SUM(si.cost), 0)::numeric as total_revenue
     FROM store_orders so
     JOIN store_items si ON so.item_id = si.id
     WHERE so.order_type = 'purchase' AND so.status != 'cancelled'
       AND si.cost > 0 AND so.convention_id = $1
     GROUP BY si.name
     ORDER BY total_revenue DESC`, [conventionId]);
    // 6. Purchases Tix vs Currency
    const tixPurchases = await db_1.pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total_tix), 0)::int AS total_tix
     FROM store_orders 
     WHERE order_type = 'purchase' AND status != 'cancelled' AND convention_id = $1`, [conventionId]);
    const currencyPurchases = await db_1.pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(si.cost), 0)::numeric AS total_currency
     FROM store_orders so
     JOIN store_items si ON so.item_id = si.id
     WHERE so.order_type = 'purchase' AND so.status != 'cancelled'
       AND si.cost > 0 AND so.convention_id = $1`, [conventionId]);
    // 7. Vouchers sold and unused
    const vouchersSold = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM transactions 
     WHERE type = 'voucher' AND reason = 'topup' AND convention_id = $1`, [conventionId]);
    // Calculate unused vouchers: total topped up - total used for events
    const vouchersUsed = await db_1.pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0)::int AS total
     FROM transactions 
     WHERE type = 'voucher' AND reason = 'event_entry' AND convention_id = $1`, [conventionId]);
    const vouchersUnused = vouchersSold.rows[0].total - vouchersUsed.rows[0].total;
    const eventsPlayed = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'finished' AND convention_id = $1`, [conventionId]);
    const eventsOngoing = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'ongoing' AND convention_id = $1`, [conventionId]);
    const eventsOpen = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'open' AND convention_id = $1`, [conventionId]);
    const totalRegistrations = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM event_participants WHERE convention_id = $1`, [conventionId]);
    const storeReservations = await db_1.pool.query(`SELECT COUNT(*)::int AS count
     FROM store_orders WHERE order_type = 'reserve' AND status = 'reserved' AND convention_id = $1`, [conventionId]);
    return {
        // New detailed statistics
        players: {
            total: totalPlayers.rows[0].count,
            names: playerNames.rows,
        },
        events: {
            total: totalEvents.rows[0].count,
            type_breakdown: eventTypeBreakdown.rows,
            players_per_event: playersPerEvent.rows,
            finished: eventsPlayed.rows[0].count,
            ongoing: eventsOngoing.rows[0].count,
            open: eventsOpen.rows[0].count,
            total_registrations: totalRegistrations.rows[0].count,
        },
        tix: {
            awarded: tixAwarded.rows[0].total,
            used: tixUsed.rows[0].total,
            usage_by_product: tixUsageByProduct.rows,
        },
        store: {
            real_currency_sales: realCurrencySales.rows,
            tix_purchases: tixPurchases.rows[0],
            currency_purchases: currencyPurchases.rows[0],
            active_reservations: storeReservations.rows[0].count,
        },
        vouchers: {
            sold: vouchersSold.rows[0].total,
            used: vouchersUsed.rows[0].total,
            unused: vouchersUnused,
        },
    };
}
//# sourceMappingURL=statsService.js.map