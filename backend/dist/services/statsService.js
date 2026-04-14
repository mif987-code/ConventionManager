"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = getStats;
const db_1 = require("../config/db");
async function getStats() {
    const eventsPlayed = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'finished'`);
    const eventsOngoing = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'ongoing'`);
    const eventsOpen = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE status = 'open'`);
    const totalPlayers = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM users`);
    const vouchersUsedForEvents = await db_1.pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0)::int AS total
     FROM transactions WHERE type = 'voucher' AND reason = 'event_entry'`);
    const vouchersToppedup = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM transactions WHERE type = 'voucher' AND reason = 'topup'`);
    const tixGiven = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::int AS total
     FROM transactions WHERE type = 'tix' AND amount > 0`);
    const tixSpent = await db_1.pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0)::int AS total
     FROM transactions WHERE type = 'tix' AND amount < 0`);
    const totalRegistrations = await db_1.pool.query(`SELECT COUNT(*)::int AS count FROM event_participants`);
    const storePurchases = await db_1.pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total_tix), 0)::int AS total_tix
     FROM store_orders WHERE order_type = 'purchase' AND status != 'cancelled'`);
    const storeReservations = await db_1.pool.query(`SELECT COUNT(*)::int AS count
     FROM store_orders WHERE order_type = 'reserve' AND status = 'reserved'`);
    return {
        events: {
            finished: eventsPlayed.rows[0].count,
            ongoing: eventsOngoing.rows[0].count,
            open: eventsOpen.rows[0].count,
        },
        players: {
            total: totalPlayers.rows[0].count,
            total_registrations: totalRegistrations.rows[0].count,
        },
        vouchers: {
            topped_up: vouchersToppedup.rows[0].total,
            used_for_events: vouchersUsedForEvents.rows[0].total,
        },
        tix: {
            given: tixGiven.rows[0].total,
            spent: tixSpent.rows[0].total,
        },
        store: {
            purchases: storePurchases.rows[0].count,
            purchase_tix_total: storePurchases.rows[0].total_tix,
            active_reservations: storeReservations.rows[0].count,
        },
    };
}
//# sourceMappingURL=statsService.js.map