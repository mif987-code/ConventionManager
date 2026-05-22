"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventType = createEventType;
exports.updateEventType = updateEventType;
exports.getAllEventTypes = getAllEventTypes;
exports.getEventTypeById = getEventTypeById;
exports.deleteEventType = deleteEventType;
exports.duplicateEventType = duplicateEventType;
exports.createEvent = createEvent;
exports.getEventById = getEventById;
exports.getAllEvents = getAllEvents;
exports.getEventParticipants = getEventParticipants;
exports.registerToEvent = registerToEvent;
exports.startEvent = startEvent;
exports.createNextRound = createNextRound;
exports.reportMatchResult = reportMatchResult;
exports.getEventRounds = getEventRounds;
exports.getRoundMatches = getRoundMatches;
exports.getAllEventMatches = getAllEventMatches;
exports.setParticipantResult = setParticipantResult;
exports.finishEvent = finishEvent;
exports.cancelEvent = cancelEvent;
const db_1 = require("../config/db");
const transactionService_1 = require("./transactionService");
// --- Event Types ---
async function createEventType(name, category, format, entryCostVouchers, maxPlayers, prizeStructure, prizeStructureTies, tournamentStructure = 'swiss', conventionId) {
    const result = await db_1.pool.query(`INSERT INTO event_types (name, category, format, entry_cost_vouchers, max_players, prize_structure, prize_structure_ties, tournament_structure, convention_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`, [name, category, format, entryCostVouchers, maxPlayers, JSON.stringify(prizeStructure), JSON.stringify(prizeStructureTies || {}), tournamentStructure, conventionId || null]);
    return result.rows[0];
}
async function updateEventType(id, fields) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (fields.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(fields.name);
    }
    if (fields.category !== undefined) {
        sets.push(`category = $${idx++}`);
        params.push(fields.category);
    }
    if (fields.format !== undefined) {
        sets.push(`format = $${idx++}`);
        params.push(fields.format);
    }
    if (fields.entry_cost_vouchers !== undefined) {
        sets.push(`entry_cost_vouchers = $${idx++}`);
        params.push(fields.entry_cost_vouchers);
    }
    if (fields.max_players !== undefined) {
        sets.push(`max_players = $${idx++}`);
        params.push(fields.max_players);
    }
    if (fields.prize_structure !== undefined) {
        sets.push(`prize_structure = $${idx++}`);
        params.push(JSON.stringify(fields.prize_structure));
    }
    if (fields.prize_structure_ties !== undefined) {
        sets.push(`prize_structure_ties = $${idx++}`);
        params.push(JSON.stringify(fields.prize_structure_ties));
    }
    if (fields.tournament_structure !== undefined) {
        sets.push(`tournament_structure = $${idx++}`);
        params.push(fields.tournament_structure);
    }
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await db_1.pool.query(`UPDATE event_types SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0)
        throw new Error('Event type not found');
    return result.rows[0];
}
async function getAllEventTypes(conventionId) {
    const query = conventionId
        ? `SELECT * FROM event_types WHERE convention_id = $1 ORDER BY category, name`
        : `SELECT * FROM event_types ORDER BY category, name`;
    const params = conventionId ? [conventionId] : [];
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
async function getEventTypeById(id) {
    const result = await db_1.pool.query(`SELECT * FROM event_types WHERE id = $1`, [id]);
    return result.rows[0] || null;
}
async function deleteEventType(id) {
    const result = await db_1.pool.query(`DELETE FROM event_types WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0)
        throw new Error('Event type not found');
}
async function duplicateEventType(id) {
    const original = await getEventTypeById(id);
    if (!original)
        throw new Error('Event type not found');
    return createEventType(`${original.name} (Copy)`, original.category, original.format, original.entry_cost_vouchers, original.max_players, original.prize_structure, original.prize_structure_ties, original.tournament_structure);
}
// --- Events ---
async function createEvent(name, eventTypeId, conventionId, preregistrationEnabled) {
    const eventType = await getEventTypeById(eventTypeId);
    if (!eventType)
        throw new Error('Event type not found');
    const result = await db_1.pool.query(`INSERT INTO events (name, event_type_id, convention_id, preregistration_enabled)
     VALUES ($1, $2, $3, $4)
     RETURNING *`, [name, eventTypeId, conventionId || null, preregistrationEnabled || false]);
    return result.rows[0];
}
async function getEventById(id) {
    const result = await db_1.pool.query(`SELECT e.*, et.name AS event_type_name, et.category, et.format,
            et.entry_cost_vouchers, et.max_players, et.prize_structure,
            et.tournament_structure
     FROM events e
     JOIN event_types et ON e.event_type_id = et.id
     WHERE e.id = $1`, [id]);
    return result.rows[0] || null;
}
async function getAllEvents(status, conventionId) {
    let query = `SELECT e.*, et.name AS event_type_name, et.entry_cost_vouchers, et.max_players,
               et.tournament_structure,
               (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id)::int AS participant_count
               FROM events e
               JOIN event_types et ON e.event_type_id = et.id`;
    const params = [];
    const conditions = [];
    if (status)
        conditions.push(`e.status = $${conditions.length + 1}`);
    if (conventionId)
        conditions.push(`e.convention_id = $${conditions.length + 1}`);
    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
        if (status)
            params.push(status);
        if (conventionId)
            params.push(conventionId);
    }
    query += ` ORDER BY e.created_at DESC`;
    const result = await db_1.pool.query(query, params);
    return result.rows;
}
async function getEventParticipants(eventId) {
    const result = await db_1.pool.query(`SELECT ep.*, u.name AS user_name, u.nfc_uid
     FROM event_participants ep
     JOIN users u ON ep.user_id = u.id
     WHERE ep.event_id = $1
     ORDER BY ep.match_points DESC, ep.wins DESC, ep.registered_at`, [eventId]);
    return result.rows;
}
// --- Registration (with DB transaction for safety) ---
async function registerToEvent(userId, eventId, createdBy = 'system') {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. Check event exists and is open
        const eventRes = await client.query(`SELECT e.*, et.entry_cost_vouchers, et.max_players
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1
       FOR UPDATE`, [eventId]);
        const event = eventRes.rows[0];
        if (!event)
            throw new Error('Event not found');
        if (event.status !== 'open')
            throw new Error('Event is not open for registration');
        // 2. Check not already registered
        const existingRes = await client.query(`SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
        if (existingRes.rows.length > 0)
            throw new Error('Already registered for this event');
        // 3. Check max players
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM event_participants WHERE event_id = $1`, [eventId]);
        if (countRes.rows[0].count >= event.max_players)
            throw new Error('Event is full');
        // 4. Check voucher balance (scoped to convention)
        const balance = await (0, transactionService_1.getBalance)(userId, 'voucher', client, event.convention_id);
        if (balance < event.entry_cost_vouchers) {
            throw new Error(`Not enough vouchers. Need ${event.entry_cost_vouchers}, have ${balance}`);
        }
        // 5. Deduct vouchers via ledger
        await (0, transactionService_1.addTransaction)({
            userId,
            type: 'voucher',
            amount: -event.entry_cost_vouchers,
            reason: 'event_entry',
            eventId,
            createdBy,
            client,
            conventionId: event.convention_id,
        });
        // 6. Add participant
        await client.query(`INSERT INTO event_participants (event_id, user_id, convention_id) VALUES ($1, $2, $3)`, [eventId, userId, event.convention_id]);
        await client.query('COMMIT');
        return { success: true, message: 'Registered successfully', costDeducted: event.entry_cost_vouchers };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// --- Start Event (calculates rounds based on tournament structure) ---
function calcSwissRounds(playerCount) {
    if (playerCount <= 4)
        return 2;
    if (playerCount <= 8)
        return 3;
    if (playerCount <= 16)
        return 4;
    if (playerCount <= 32)
        return 5;
    return Math.ceil(Math.log2(playerCount));
}
function calcSingleElimRounds(playerCount) {
    return Math.ceil(Math.log2(playerCount));
}
async function startEvent(eventId) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const eventRes = await client.query(`SELECT e.*, et.tournament_structure,
              (SELECT COUNT(*)::int FROM event_participants WHERE event_id = e.id) AS player_count
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'open' FOR UPDATE`, [eventId]);
        if (eventRes.rows.length === 0)
            throw new Error('Event not found or not in open state');
        const event = eventRes.rows[0];
        if (event.player_count < 2)
            throw new Error('Need at least 2 players to start');
        const isSingleElim = event.tournament_structure === 'single_elimination';
        const totalRounds = isSingleElim
            ? calcSingleElimRounds(event.player_count)
            : calcSwissRounds(event.player_count);
        await client.query(`UPDATE events SET status = 'ongoing', current_round = 0, total_rounds = $2 WHERE id = $1`, [eventId, totalRounds]);
        await client.query('COMMIT');
        return { ...(await getEventById(eventId)), total_rounds: totalRounds };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// --- Round Management (Swiss + Single Elimination) ---
async function createNextRound(eventId) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const eventRes = await client.query(`SELECT e.*, et.tournament_structure
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'ongoing' FOR UPDATE`, [eventId]);
        const event = eventRes.rows[0];
        if (!event)
            throw new Error('Event not found or not ongoing');
        const isSingleElim = event.tournament_structure === 'single_elimination';
        // Check all matches in current round are reported (if not round 0)
        if (event.current_round > 0) {
            const unreported = await client.query(`SELECT COUNT(*)::int AS cnt FROM event_matches em
         JOIN event_rounds er ON em.round_id = er.id
         WHERE er.event_id = $1 AND er.round_number = $2 AND em.reported = FALSE`, [eventId, event.current_round]);
            if (unreported.rows[0].cnt > 0) {
                throw new Error(`Round ${event.current_round} has unreported matches`);
            }
        }
        const nextRound = event.current_round + 1;
        if (nextRound > event.total_rounds)
            throw new Error('All rounds completed. Finish the event.');
        // Create round record
        const roundRes = await client.query(`INSERT INTO event_rounds (event_id, round_number) VALUES ($1, $2) RETURNING *`, [eventId, nextRound]);
        const round = roundRes.rows[0];
        const matches = [];
        if (isSingleElim) {
            // ---- SINGLE ELIMINATION PAIRING ----
            await pairSingleElimination(client, eventId, round, nextRound, event, matches);
        }
        else {
            // ---- SWISS PAIRING ----
            await pairSwiss(client, eventId, round, matches);
        }
        // Update current round
        await client.query(`UPDATE events SET current_round = $2 WHERE id = $1`, [eventId, nextRound]);
        await client.query('COMMIT');
        return { round: nextRound, total_rounds: event.total_rounds, matches };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// --- Swiss pairing helper ---
async function pairSwiss(client, eventId, round, matches) {
    // Get participants sorted by match_points (top vs next-top)
    const participants = await client.query(`SELECT ep.user_id, ep.match_points, ep.wins
     FROM event_participants ep
     WHERE ep.event_id = $1
     ORDER BY ep.match_points DESC, ep.wins DESC, RANDOM()`, [eventId]);
    const players = participants.rows.map((p) => p.user_id);
    // Pair players: adjacent pairing from sorted standings
    const paired = new Set();
    for (let i = 0; i < players.length; i++) {
        if (paired.has(players[i]))
            continue;
        let opponent = null;
        for (let j = i + 1; j < players.length; j++) {
            if (!paired.has(players[j])) {
                opponent = players[j];
                paired.add(players[j]);
                break;
            }
        }
        paired.add(players[i]);
        // Insert match (opponent null = bye)
        const matchRes = await client.query(`INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, reported)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [round.id, eventId, players[i], opponent, opponent === null]);
        // If bye, auto-award a win
        if (opponent === null) {
            await client.query(`UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`, [matchRes.rows[0].id]);
            await client.query(`UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`, [eventId, players[i]]);
        }
        matches.push(matchRes.rows[0]);
    }
}
// --- Single Elimination pairing helper ---
async function pairSingleElimination(client, eventId, round, nextRound, event, matches) {
    if (nextRound === 1) {
        // Round 1: seed players randomly, assign byes for non-power-of-2
        const participants = await client.query(`SELECT ep.user_id FROM event_participants ep
       WHERE ep.event_id = $1 ORDER BY RANDOM()`, [eventId]);
        const players = participants.rows.map((p) => p.user_id);
        const totalSlots = Math.pow(2, event.total_rounds); // e.g. 8 for 3 rounds
        const numByes = totalSlots - players.length;
        // Build bracket slots: real players first, then nulls for byes
        // Byes go to the bottom seeds (last positions) so top players get byes
        const slots = [];
        for (let i = 0; i < totalSlots; i++) {
            slots.push(i < players.length ? players[i] : null);
        }
        // Create matches from pairs of slots
        for (let i = 0; i < totalSlots; i += 2) {
            const p1 = slots[i];
            const p2 = slots[i + 1];
            if (p1 === null && p2 === null)
                continue; // shouldn't happen
            const isBye = p1 === null || p2 === null;
            const player1 = p1 ?? p2;
            const player2 = isBye ? null : p2;
            const matchRes = await client.query(`INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, reported)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`, [round.id, eventId, player1, player2, isBye]);
            // If bye, auto-award a win
            if (isBye) {
                await client.query(`UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`, [matchRes.rows[0].id]);
                await client.query(`UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`, [eventId, player1]);
            }
            matches.push(matchRes.rows[0]);
        }
    }
    else {
        // Round 2+: winners from previous round's matches advance
        // Matches are paired by bracket position: match[0] winner vs match[1] winner, etc.
        const prevMatches = await client.query(`SELECT em.* FROM event_matches em
       JOIN event_rounds er ON em.round_id = er.id
       WHERE er.event_id = $1 AND er.round_number = $2
       ORDER BY em.id`, [eventId, nextRound - 1]);
        const prevResults = prevMatches.rows;
        // Determine winners from each match
        const winners = [];
        for (const m of prevResults) {
            if (!m.reported)
                throw new Error(`Previous round has unreported matches`);
            if (m.player2_id === null) {
                // Bye — player1 advances
                winners.push(m.player1_id);
            }
            else if (m.player1_wins > m.player2_wins) {
                winners.push(m.player1_id);
            }
            else if (m.player2_wins > m.player1_wins) {
                winners.push(m.player2_id);
            }
            else {
                // Draw in single elimination — shouldn't happen, but default to player1
                winners.push(m.player1_id);
            }
        }
        // Pair winners: [0] vs [1], [2] vs [3], etc.
        for (let i = 0; i < winners.length; i += 2) {
            const p1 = winners[i];
            const p2 = i + 1 < winners.length ? winners[i + 1] : null;
            const isBye = p2 === null;
            const matchRes = await client.query(`INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, reported)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`, [round.id, eventId, p1, p2, isBye]);
            if (isBye) {
                await client.query(`UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`, [matchRes.rows[0].id]);
                await client.query(`UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`, [eventId, p1]);
            }
            matches.push(matchRes.rows[0]);
        }
    }
}
async function reportMatchResult(matchId, player1Wins, player2Wins, matchDraws) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const matchRes = await client.query(`SELECT * FROM event_matches WHERE id = $1 FOR UPDATE`, [matchId]);
        const match = matchRes.rows[0];
        if (!match)
            throw new Error('Match not found');
        if (!match.player2_id)
            throw new Error('Cannot report a bye match');
        // If already reported, reverse old stats first
        if (match.reported) {
            const oldP1 = match.player1_wins;
            const oldP2 = match.player2_wins;
            if (oldP1 > oldP2) {
                await client.query(`UPDATE event_participants SET wins = wins - 1, match_points = match_points - 3 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
                await client.query(`UPDATE event_participants SET losses = losses - 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
            }
            else if (oldP2 > oldP1) {
                await client.query(`UPDATE event_participants SET wins = wins - 1, match_points = match_points - 3 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
                await client.query(`UPDATE event_participants SET losses = losses - 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
            }
            else {
                await client.query(`UPDATE event_participants SET draws = draws - 1, match_points = match_points - 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
                await client.query(`UPDATE event_participants SET draws = draws - 1, match_points = match_points - 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
            }
        }
        await client.query(`UPDATE event_matches SET player1_wins = $2, player2_wins = $3, draws = $4, reported = TRUE WHERE id = $1`, [matchId, player1Wins, player2Wins, matchDraws]);
        // Determine match winner
        if (player1Wins > player2Wins) {
            // Player 1 wins the match
            await client.query(`UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
            await client.query(`UPDATE event_participants SET losses = losses + 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
        }
        else if (player2Wins > player1Wins) {
            // Player 2 wins the match
            await client.query(`UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
            await client.query(`UPDATE event_participants SET losses = losses + 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
        }
        else {
            // Draw
            await client.query(`UPDATE event_participants SET draws = draws + 1, match_points = match_points + 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player1_id]);
            await client.query(`UPDATE event_participants SET draws = draws + 1, match_points = match_points + 1 WHERE event_id = $1 AND user_id = $2`, [match.event_id, match.player2_id]);
        }
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
async function getEventRounds(eventId) {
    const result = await db_1.pool.query(`SELECT * FROM event_rounds WHERE event_id = $1 ORDER BY round_number`, [eventId]);
    return result.rows;
}
async function getRoundMatches(eventId, roundNumber) {
    const result = await db_1.pool.query(`SELECT em.*, er.round_number,
            u1.name AS player1_name, u2.name AS player2_name,
            u1.nfc_uid AS player1_nfc, u2.nfc_uid AS player2_nfc
     FROM event_matches em
     JOIN event_rounds er ON em.round_id = er.id
     LEFT JOIN users u1 ON em.player1_id = u1.id
     LEFT JOIN users u2 ON em.player2_id = u2.id
     WHERE er.event_id = $1 AND er.round_number = $2
     ORDER BY em.id`, [eventId, roundNumber]);
    return result.rows;
}
async function getAllEventMatches(eventId) {
    const result = await db_1.pool.query(`SELECT em.*, er.round_number,
            u1.name AS player1_name, u2.name AS player2_name
     FROM event_matches em
     JOIN event_rounds er ON em.round_id = er.id
     LEFT JOIN users u1 ON em.player1_id = u1.id
     LEFT JOIN users u2 ON em.player2_id = u2.id
     WHERE er.event_id = $1
     ORDER BY er.round_number, em.id`, [eventId]);
    return result.rows;
}
// --- Set Results (keep for manual override) ---
async function setParticipantResult(eventId, userId, position) {
    const result = await db_1.pool.query(`UPDATE event_participants SET result_position = $3
     WHERE event_id = $1 AND user_id = $2
     RETURNING *`, [eventId, userId, position]);
    if (result.rows.length === 0)
        throw new Error('Participant not found');
    return result.rows[0];
}
// --- Finish Event + Distribute Prizes by W/L Record ---
async function finishEvent(eventId, createdBy = 'system') {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const eventRes = await client.query(`SELECT e.*, et.prize_structure, et.prize_structure_ties, et.tournament_structure
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'ongoing'
       FOR UPDATE`, [eventId]);
        const event = eventRes.rows[0];
        if (!event)
            throw new Error('Event not found or not ongoing');
        const participants = await client.query(`SELECT user_id, wins, losses, draws, match_points FROM event_participants WHERE event_id = $1`, [eventId]);
        // Determine if any player has ties
        const hasTies = participants.rows.some((p) => p.draws > 0);
        // Pick the right prize structure: if ties exist and ties variant is available, use it
        const tiesStructure = event.prize_structure_ties || {};
        const noTiesStructure = event.prize_structure || {};
        const hasTiesVariant = Object.keys(tiesStructure).length > 0;
        const prizeStructure = (hasTies && hasTiesVariant) ? tiesStructure : noTiesStructure;
        const prizes = [];
        // Assign positions by match_points
        const sorted = [...participants.rows].sort((a, b) => b.match_points - a.match_points || b.wins - a.wins);
        for (let i = 0; i < sorted.length; i++) {
            await client.query(`UPDATE event_participants SET result_position = $3 WHERE event_id = $1 AND user_id = $2`, [eventId, sorted[i].user_id, i + 1]);
        }
        // Check if prize structure uses placement keys (Commander: 1st, 2nd, 3rd, 4th)
        const placementSuffixes = ['st', 'nd', 'rd', 'th'];
        const isPlacementBased = Object.keys(prizeStructure).some(k => placementSuffixes.some(s => k.endsWith(s)));
        if (isPlacementBased) {
            // Award tix by final position (Commander style)
            for (let i = 0; i < sorted.length; i++) {
                const pos = i + 1;
                const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
                const key = `${pos}${suffix}`;
                const reward = prizeStructure[key] ?? 0;
                if (reward > 0) {
                    await (0, transactionService_1.addTransaction)({
                        userId: sorted[i].user_id,
                        type: 'tix',
                        amount: reward,
                        reason: 'prize',
                        eventId,
                        createdBy,
                        client,
                        conventionId: event.convention_id,
                    });
                }
                prizes.push({ userId: sorted[i].user_id, record: key, amount: reward });
            }
        }
        else {
            // Award tix based on W-L-T record (Swiss style)
            for (const p of participants.rows) {
                const recordNoTies = `${p.wins}-${p.losses}`;
                const recordWithTies = `${p.wins}-${p.losses}-${p.draws}`;
                // Try exact W-L-T first, then W-L
                const reward = prizeStructure[recordWithTies] ?? prizeStructure[recordNoTies] ?? 0;
                if (reward > 0) {
                    await (0, transactionService_1.addTransaction)({
                        userId: p.user_id,
                        type: 'tix',
                        amount: reward,
                        reason: 'prize',
                        eventId,
                        createdBy,
                        client,
                        conventionId: event.convention_id,
                    });
                    prizes.push({ userId: p.user_id, record: recordWithTies, amount: reward });
                }
            }
        }
        await client.query(`UPDATE events SET status = 'finished', finished_at = NOW() WHERE id = $1`, [eventId]);
        await client.query('COMMIT');
        return { success: true, prizes };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// --- Cancel Event + Refund (with DB transaction) ---
async function cancelEvent(eventId, createdBy = 'system') {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const eventRes = await client.query(`SELECT e.*, et.entry_cost_vouchers
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status IN ('open', 'ongoing')
       FOR UPDATE`, [eventId]);
        const event = eventRes.rows[0];
        if (!event)
            throw new Error('Event not found or already finished/cancelled');
        // Refund all participants
        const participants = await client.query(`SELECT user_id FROM event_participants WHERE event_id = $1`, [eventId]);
        for (const p of participants.rows) {
            await (0, transactionService_1.addTransaction)({
                userId: p.user_id,
                type: 'voucher',
                amount: event.entry_cost_vouchers,
                reason: 'refund',
                eventId,
                createdBy,
                client,
                conventionId: event.convention_id,
            });
        }
        await client.query(`UPDATE events SET status = 'cancelled' WHERE id = $1`, [eventId]);
        await client.query('COMMIT');
        return { success: true, refundedCount: participants.rows.length };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=eventService.js.map