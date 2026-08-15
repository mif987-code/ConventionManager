import { pool } from '../config/db';
import { addTransaction, getBalance } from './transactionService';

export type TournamentStructure = 'swiss' | 'single_elimination';
export type TeamMode = 'single' | '2hg';

/** A prize tier's value: either a plain Tix number (legacy), or an object carrying
 *  a Tix amount and/or a Special Voucher to auto-award to whoever hits that tier. */
export type PrizeEntry = number | { tix?: number; special_voucher_id?: number | null };

export interface EventType {
  id: number;
  name: string;
  category: string;
  format: string | null;
  tournament_structure: TournamentStructure;
  entry_cost_vouchers: number;
  max_players: number;
  tix_per_player: number | null;
  prize_structure: Record<string, PrizeEntry>;
  prize_structure_ties: Record<string, PrizeEntry>;
  team_mode: TeamMode;
  created_at: Date;
  updated_at: Date;
}

function prizeTixAmount(entry: PrizeEntry | undefined): number {
  if (entry === undefined || entry === null) return 0;
  if (typeof entry === 'number') return entry;
  return entry.tix ?? 0;
}

function prizeSpecialVoucherId(entry: PrizeEntry | undefined): number | null {
  if (entry === undefined || entry === null || typeof entry === 'number') return null;
  return entry.special_voucher_id ?? null;
}

export interface Event {
  id: number;
  name: string;
  event_type_id: number;
  status: 'open' | 'ongoing' | 'finished' | 'cancelled';
  current_round: number;
  total_rounds: number;
  created_at: Date;
  finished_at: Date | null;
  schedule_day: string | null;
  start_time: string | null;
  end_time: string | null;
  track: string | null;
  schedule_color: string | null;
  sort_order: number;
}

export interface EventScheduleFields {
  schedule_day?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  track?: string | null;
  schedule_color?: string | null;
  sort_order?: number;
}

// --- Event Types ---

export async function createEventType(
  name: string,
  category: string,
  format: string | null,
  entryCostVouchers: number,
  maxPlayers: number,
  prizeStructure: Record<string, PrizeEntry>,
  prizeStructureTies?: Record<string, PrizeEntry>,
  tournamentStructure: TournamentStructure = 'swiss',
  conventionId?: number,
  tixPerPlayer?: number | null,
  teamMode: TeamMode = 'single'
): Promise<EventType> {
  const result = await pool.query(
    `INSERT INTO event_types (name, category, format, entry_cost_vouchers, max_players, tix_per_player, prize_structure, prize_structure_ties, tournament_structure, convention_id, team_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [name, category, format, entryCostVouchers, maxPlayers, tixPerPlayer ?? null, JSON.stringify(prizeStructure), JSON.stringify(prizeStructureTies || {}), tournamentStructure, conventionId || null, teamMode]
  );
  return result.rows[0];
}

export async function updateEventType(
  id: number,
  fields: { name?: string; category?: string; format?: string | null; entry_cost_vouchers?: number; max_players?: number; tix_per_player?: number | null; prize_structure?: Record<string, PrizeEntry>; prize_structure_ties?: Record<string, PrizeEntry>; tournament_structure?: TournamentStructure; team_mode?: TeamMode }
): Promise<EventType> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.category !== undefined) { sets.push(`category = $${idx++}`); params.push(fields.category); }
  if (fields.format !== undefined) { sets.push(`format = $${idx++}`); params.push(fields.format); }
  if (fields.entry_cost_vouchers !== undefined) { sets.push(`entry_cost_vouchers = $${idx++}`); params.push(fields.entry_cost_vouchers); }
  if (fields.max_players !== undefined) { sets.push(`max_players = $${idx++}`); params.push(fields.max_players); }
  if ('tix_per_player' in fields) { sets.push(`tix_per_player = $${idx++}`); params.push(fields.tix_per_player ?? null); }
  if (fields.prize_structure !== undefined) { sets.push(`prize_structure = $${idx++}`); params.push(JSON.stringify(fields.prize_structure)); }
  if (fields.prize_structure_ties !== undefined) { sets.push(`prize_structure_ties = $${idx++}`); params.push(JSON.stringify(fields.prize_structure_ties)); }
  if (fields.tournament_structure !== undefined) { sets.push(`tournament_structure = $${idx++}`); params.push(fields.tournament_structure); }
  if (fields.team_mode !== undefined) { sets.push(`team_mode = $${idx++}`); params.push(fields.team_mode); }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const result = await pool.query(
    `UPDATE event_types SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new Error('Event type not found');
  return result.rows[0];
}

export async function getAllEventTypes(conventionId?: number): Promise<EventType[]> {
  const query = conventionId
    ? `SELECT * FROM event_types WHERE convention_id = $1 ORDER BY category, name`
    : `SELECT * FROM event_types ORDER BY category, name`;
  const params = conventionId ? [conventionId] : [];
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getEventTypeById(id: number): Promise<EventType | null> {
  const result = await pool.query(`SELECT * FROM event_types WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function deleteEventType(id: number): Promise<void> {
  const result = await pool.query(`DELETE FROM event_types WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) throw new Error('Event type not found');
}

export async function duplicateEventType(id: number): Promise<EventType> {
  const original = await getEventTypeById(id);
  if (!original) throw new Error('Event type not found');
  return createEventType(
    `${original.name} (Copy)`,
    original.category,
    original.format,
    original.entry_cost_vouchers,
    original.max_players,
    original.prize_structure,
    original.prize_structure_ties,
    original.tournament_structure,
    undefined,
    original.tix_per_player,
    original.team_mode
  );
}

// --- Events ---

export async function createEvent(
  name: string,
  eventTypeId: number,
  conventionId?: number,
  preregistrationEnabled?: boolean,
  schedule?: EventScheduleFields
): Promise<Event> {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) throw new Error('Event type not found');

  const result = await pool.query(
    `INSERT INTO events (name, event_type_id, convention_id, preregistration_enabled, schedule_day, start_time, end_time, track, schedule_color, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      name,
      eventTypeId,
      conventionId || null,
      preregistrationEnabled || false,
      schedule?.schedule_day ?? null,
      schedule?.start_time ?? null,
      schedule?.end_time ?? null,
      schedule?.track ?? null,
      schedule?.schedule_color ?? '#6366f1',
      schedule?.sort_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updateEventSchedule(id: number, fields: EventScheduleFields): Promise<Event> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if ('schedule_day' in fields) { sets.push(`schedule_day = $${idx++}`); params.push(fields.schedule_day ?? null); }
  if ('start_time' in fields) { sets.push(`start_time = $${idx++}`); params.push(fields.start_time ?? null); }
  if ('end_time' in fields) { sets.push(`end_time = $${idx++}`); params.push(fields.end_time ?? null); }
  if ('track' in fields) { sets.push(`track = $${idx++}`); params.push(fields.track ?? null); }
  if ('schedule_color' in fields) { sets.push(`schedule_color = $${idx++}`); params.push(fields.schedule_color ?? null); }
  if (fields.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(fields.sort_order); }

  if (sets.length === 0) {
    const existing = await getEventById(id);
    if (!existing) throw new Error('Event not found');
    return existing;
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new Error('Event not found');
  return result.rows[0];
}

export async function updateEventDetails(id: number, fields: { name?: string; preregistration_enabled?: boolean }): Promise<Event> {
  const existing = await pool.query(`SELECT id, status FROM events WHERE id = $1`, [id]);
  if (existing.rows.length === 0) throw new Error('Event not found');
  if (existing.rows[0].status !== 'open') throw new Error('Only open events can be edited');

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (fields.name !== undefined) {
    if (!fields.name.trim()) throw new Error('name cannot be empty');
    sets.push(`name = $${idx++}`);
    params.push(fields.name.trim());
  }
  if (fields.preregistration_enabled !== undefined) {
    sets.push(`preregistration_enabled = $${idx++}`);
    params.push(fields.preregistration_enabled);
  }

  if (sets.length === 0) {
    const current = await getEventById(id);
    if (!current) throw new Error('Event not found');
    return current;
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function getEventById(id: number) {
  const result = await pool.query(
    `SELECT e.*, et.name AS event_type_name, et.category, et.format,
            et.entry_cost_vouchers, et.max_players, et.tix_per_player,
            et.prize_structure, et.prize_structure_ties, et.tournament_structure, et.team_mode
     FROM events e
     JOIN event_types et ON e.event_type_id = et.id
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getAllEvents(status?: string, conventionId?: number) {
  let query = `SELECT e.*, et.name AS event_type_name, et.category, et.entry_cost_vouchers, et.max_players,
               et.tournament_structure,
               (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id)::int AS participant_count
               FROM events e
               JOIN event_types et ON e.event_type_id = et.id`;
  const params: any[] = [];
  const conditions: string[] = [];

  if (status) conditions.push(`e.status = $${conditions.length + 1}`);
  if (conventionId) conditions.push(`e.convention_id = $${conditions.length + 1}`);

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
    if (status) params.push(status);
    if (conventionId) params.push(conventionId);
  }

  query += ` ORDER BY e.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getEventParticipants(eventId: number) {
  const result = await pool.query(
    `SELECT ep.*, u.name AS user_name, u.nfc_uid, et.name AS team_name
     FROM event_participants ep
     JOIN users u ON ep.user_id = u.id
     LEFT JOIN event_teams et ON ep.team_id = et.id
     WHERE ep.event_id = $1
     ORDER BY ep.match_points DESC, ep.wins DESC, ep.registered_at`,
    [eventId]
  );
  return result.rows;
}

// --- 2HG Team Pairing ---

export async function getEventTeams(eventId: number) {
  const result = await pool.query(
    `SELECT et.*, u1.name AS member1_name, u2.name AS member2_name
     FROM event_teams et
     JOIN users u1 ON et.member1_id = u1.id
     JOIN users u2 ON et.member2_id = u2.id
     WHERE et.event_id = $1
     ORDER BY et.created_at`,
    [eventId]
  );
  return result.rows;
}

export async function createEventTeam(eventId: number, user1Id: number, user2Id: number) {
  if (user1Id === user2Id) throw new Error('A team requires two different players');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT e.*, et.team_mode FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'open' FOR UPDATE`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) throw new Error('Event not found or not open for pairing');
    if (event.team_mode !== '2hg') throw new Error('This event type is not configured for 2-Headed Giant teams');

    const participantsRes = await client.query(
      `SELECT ep.*, u.last_name, u.name FROM event_participants ep
       JOIN users u ON ep.user_id = u.id
       WHERE ep.event_id = $1 AND ep.user_id IN ($2, $3) FOR UPDATE`,
      [eventId, user1Id, user2Id]
    );
    if (participantsRes.rows.length !== 2) throw new Error('Both players must be registered for this event');
    if (participantsRes.rows.some((p: any) => p.team_id !== null)) {
      throw new Error('One or both players are already paired with a partner');
    }

    const p1 = participantsRes.rows.find((p: any) => p.user_id === user1Id);
    const p2 = participantsRes.rows.find((p: any) => p.user_id === user2Id);
    const lastName1 = (p1.last_name || p1.name || '').trim();
    const lastName2 = (p2.last_name || p2.name || '').trim();
    const teamName = `${lastName1} / ${lastName2}`;

    const teamRes = await client.query(
      `INSERT INTO event_teams (event_id, member1_id, member2_id, name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [eventId, user1Id, user2Id, teamName]
    );
    const team = teamRes.rows[0];

    await client.query(
      `UPDATE event_participants SET team_id = $1 WHERE event_id = $2 AND user_id IN ($3, $4)`,
      [team.id, eventId, user1Id, user2Id]
    );

    await client.query('COMMIT');
    return team;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteEventTeam(eventId: number, teamId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT status FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    if (!eventRes.rows[0]) throw new Error('Event not found');
    if (eventRes.rows[0].status !== 'open') throw new Error('Teams can only be unlinked before the event starts');

    const teamRes = await client.query(
      `DELETE FROM event_teams WHERE id = $1 AND event_id = $2 RETURNING *`,
      [teamId, eventId]
    );
    if (teamRes.rows.length === 0) throw new Error('Team not found');

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Registration (with DB transaction for safety) ---

export async function registerToEvent(userId: number, eventId: number, createdBy: string = 'system') {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check event exists and is open
    const eventRes = await client.query(
      `SELECT e.*, et.entry_cost_vouchers, et.max_players
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1
       FOR UPDATE`,
      [eventId]
    );

    const event = eventRes.rows[0];
    if (!event) throw new Error('Event not found');
    if (event.status !== 'open') throw new Error('Event is not open for registration');

    // 2. Check not already registered
    const existingRes = await client.query(
      `SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    if (existingRes.rows.length > 0) throw new Error('Already registered for this event');

    // 3. Check max players
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM event_participants WHERE event_id = $1`,
      [eventId]
    );
    if (countRes.rows[0].count >= event.max_players) throw new Error('Event is full');

    // 4. Check voucher balance (scoped to convention)
    const balance = await getBalance(userId, 'voucher', client, event.convention_id);
    if (balance < event.entry_cost_vouchers) {
      throw new Error(`Not enough vouchers. Need ${event.entry_cost_vouchers}, have ${balance}`);
    }

    // 5. Deduct vouchers via ledger
    await addTransaction({
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
    await client.query(
      `INSERT INTO event_participants (event_id, user_id, convention_id) VALUES ($1, $2, $3)`,
      [eventId, userId, event.convention_id]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Registered successfully', costDeducted: event.entry_cost_vouchers };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Start Event (calculates rounds based on tournament structure) ---

function calcSwissRounds(playerCount: number): number {
  if (playerCount <= 4) return 2;
  if (playerCount <= 8) return 3;
  if (playerCount <= 16) return 4;
  if (playerCount <= 32) return 5;
  return Math.ceil(Math.log2(playerCount));
}

function calcSingleElimRounds(playerCount: number): number {
  return Math.ceil(Math.log2(playerCount));
}

export async function startEvent(eventId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT e.*, et.tournament_structure, et.team_mode,
              (SELECT COUNT(*)::int FROM event_participants WHERE event_id = e.id) AS player_count,
              (SELECT COUNT(*)::int FROM event_participants WHERE event_id = e.id AND team_id IS NULL) AS unpaired_count
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'open' FOR UPDATE`,
      [eventId]
    );
    if (eventRes.rows.length === 0) throw new Error('Event not found or not in open state');

    const event = eventRes.rows[0];
    if (event.player_count < 2) throw new Error('Need at least 2 players to start');

    const isTwoHeadedGiant = event.team_mode === '2hg';
    let pairingUnitCount = event.player_count;

    if (isTwoHeadedGiant) {
      if (event.player_count % 2 !== 0) {
        throw new Error('2-Headed Giant events require an even number of registered players. Unregister or add one more player before starting.');
      }
      if (event.unpaired_count > 0) {
        throw new Error(`${event.unpaired_count} player(s) are not yet paired with a partner. Link all players into teams before starting.`);
      }
      pairingUnitCount = event.player_count / 2;
    }

    const isSingleElim = event.tournament_structure === 'single_elimination';
    const totalRounds = isSingleElim
      ? calcSingleElimRounds(pairingUnitCount)
      : calcSwissRounds(pairingUnitCount);

    await client.query(
      `UPDATE events SET status = 'ongoing', current_round = 0, total_rounds = $2 WHERE id = $1`,
      [eventId, totalRounds]
    );

    await client.query('COMMIT');

    return { ...(await getEventById(eventId)), total_rounds: totalRounds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Round Management (Swiss + Single Elimination) ---

export async function createNextRound(eventId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT e.*, et.tournament_structure, et.team_mode
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'ongoing' FOR UPDATE`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) throw new Error('Event not found or not ongoing');

    const isSingleElim = event.tournament_structure === 'single_elimination';
    const isTwoHeadedGiant = event.team_mode === '2hg';

    // Check all matches in current round are reported (if not round 0)
    if (event.current_round > 0) {
      const unreported = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM event_matches em
         JOIN event_rounds er ON em.round_id = er.id
         WHERE er.event_id = $1 AND er.round_number = $2 AND em.reported = FALSE`,
        [eventId, event.current_round]
      );
      if (unreported.rows[0].cnt > 0) {
        throw new Error(`Round ${event.current_round} has unreported matches`);
      }
    }

    const nextRound = event.current_round + 1;
    if (nextRound > event.total_rounds) throw new Error('All rounds completed. Finish the event.');

    // Create round record
    const roundRes = await client.query(
      `INSERT INTO event_rounds (event_id, round_number) VALUES ($1, $2) RETURNING *`,
      [eventId, nextRound]
    );
    const round = roundRes.rows[0];

    const matches: any[] = [];

    if (isSingleElim) {
      // ---- SINGLE ELIMINATION PAIRING ----
      await pairSingleElimination(client, eventId, round, nextRound, event, matches, isTwoHeadedGiant);
    } else {
      // ---- SWISS PAIRING ----
      await pairSwiss(client, eventId, round, matches, isTwoHeadedGiant);
    }

    // Update current round
    await client.query(`UPDATE events SET current_round = $2 WHERE id = $1`, [eventId, nextRound]);

    await client.query('COMMIT');
    return { round: nextRound, total_rounds: event.total_rounds, matches };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Mirrored stat helpers (2HG teams apply the same result to both members) ---
async function bumpWin(client: any, eventId: number, userId: number) {
  await client.query(
    `UPDATE event_participants SET wins = wins + 1, match_points = match_points + 3 WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
}
async function bumpLoss(client: any, eventId: number, userId: number) {
  await client.query(`UPDATE event_participants SET losses = losses + 1 WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
}
async function bumpDraw(client: any, eventId: number, userId: number) {
  await client.query(
    `UPDATE event_participants SET draws = draws + 1, match_points = match_points + 1 WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
}
async function unbumpWin(client: any, eventId: number, userId: number) {
  await client.query(
    `UPDATE event_participants SET wins = wins - 1, match_points = match_points - 3 WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
}
async function unbumpLoss(client: any, eventId: number, userId: number) {
  await client.query(`UPDATE event_participants SET losses = losses - 1 WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
}
async function unbumpDraw(client: any, eventId: number, userId: number) {
  await client.query(
    `UPDATE event_participants SET draws = draws - 1, match_points = match_points - 1 WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
}

interface PairingUnit {
  repId: number;
  partnerId: number | null;
  teamId: number | null;
}

async function awardByeWin(client: any, eventId: number, unit: PairingUnit) {
  await bumpWin(client, eventId, unit.repId);
  if (unit.partnerId) await bumpWin(client, eventId, unit.partnerId);
}

async function getSwissPairingUnits(client: any, eventId: number, isTwoHeadedGiant: boolean): Promise<PairingUnit[]> {
  if (isTwoHeadedGiant) {
    const teamsRes = await client.query(
      `SELECT et.id AS team_id, et.member1_id, et.member2_id, ep.match_points, ep.wins
       FROM event_teams et
       JOIN event_participants ep ON ep.team_id = et.id AND ep.user_id = et.member1_id
       WHERE et.event_id = $1
       ORDER BY ep.match_points DESC, ep.wins DESC, RANDOM()`,
      [eventId]
    );
    return teamsRes.rows.map((r: any) => ({ repId: r.member1_id, partnerId: r.member2_id, teamId: r.team_id }));
  }
  const participants = await client.query(
    `SELECT ep.user_id, ep.match_points, ep.wins
     FROM event_participants ep
     WHERE ep.event_id = $1
     ORDER BY ep.match_points DESC, ep.wins DESC, RANDOM()`,
    [eventId]
  );
  return participants.rows.map((p: any) => ({ repId: p.user_id, partnerId: null, teamId: null }));
}

// --- Swiss pairing helper ---
async function pairSwiss(client: any, eventId: number, round: any, matches: any[], isTwoHeadedGiant: boolean = false) {
  const units = await getSwissPairingUnits(client, eventId, isTwoHeadedGiant);

  // Pair units: adjacent pairing from sorted standings
  const paired = new Set<number>();
  for (let i = 0; i < units.length; i++) {
    if (paired.has(i)) continue;

    let opponentIdx: number | null = null;
    for (let j = i + 1; j < units.length; j++) {
      if (!paired.has(j)) {
        opponentIdx = j;
        paired.add(j);
        break;
      }
    }

    paired.add(i);
    const unit = units[i];
    const opponent = opponentIdx !== null ? units[opponentIdx] : null;

    // Insert match (opponent null = bye)
    const matchRes = await client.query(
      `INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, team1_id, team2_id, reported)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [round.id, eventId, unit.repId, opponent?.repId ?? null, unit.teamId, opponent?.teamId ?? null, opponent === null]
    );

    // If bye, auto-award a win
    if (opponent === null) {
      await client.query(
        `UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`,
        [matchRes.rows[0].id]
      );
      await awardByeWin(client, eventId, unit);
    }

    matches.push(matchRes.rows[0]);
  }
}

async function getTeamPartnerMap(client: any, eventId: number): Promise<Map<number, { member1Id: number; member2Id: number }>> {
  const teamsRes = await client.query(`SELECT id, member1_id, member2_id FROM event_teams WHERE event_id = $1`, [eventId]);
  const map = new Map<number, { member1Id: number; member2Id: number }>();
  for (const t of teamsRes.rows) map.set(t.id, { member1Id: t.member1_id, member2Id: t.member2_id });
  return map;
}

function partnerOf(teamPartners: Map<number, { member1Id: number; member2Id: number }>, teamId: number | null, repId: number): number | null {
  if (!teamId) return null;
  const pair = teamPartners.get(teamId);
  if (!pair) return null;
  return pair.member1Id === repId ? pair.member2Id : pair.member1Id;
}

// --- Single Elimination pairing helper ---
async function pairSingleElimination(client: any, eventId: number, round: any, nextRound: number, event: any, matches: any[], isTwoHeadedGiant: boolean = false) {
  const teamPartners = isTwoHeadedGiant ? await getTeamPartnerMap(client, eventId) : new Map();

  if (nextRound === 1) {
    // Round 1: seed units randomly, assign byes for non-power-of-2
    const units = await getSwissPairingUnits(client, eventId, isTwoHeadedGiant);
    // Re-shuffle for round 1 seeding (getSwissPairingUnits already orders by points, all 0 at start, so RANDOM() applies)
    const totalSlots = Math.pow(2, event.total_rounds); // e.g. 8 for 3 rounds

    // Build bracket slots: real units first, then nulls for byes
    const slots: (PairingUnit | null)[] = [];
    for (let i = 0; i < totalSlots; i++) {
      slots.push(i < units.length ? units[i] : null);
    }

    // Create matches from pairs of slots
    for (let i = 0; i < totalSlots; i += 2) {
      const u1 = slots[i];
      const u2 = slots[i + 1];

      if (u1 === null && u2 === null) continue; // shouldn't happen

      const isBye = u1 === null || u2 === null;
      const unit1 = (u1 ?? u2)!;
      const unit2 = isBye ? null : u2;

      const matchRes = await client.query(
        `INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, team1_id, team2_id, reported)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [round.id, eventId, unit1.repId, unit2?.repId ?? null, unit1.teamId, unit2?.teamId ?? null, isBye]
      );

      // If bye, auto-award a win
      if (isBye) {
        await client.query(
          `UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`,
          [matchRes.rows[0].id]
        );
        await awardByeWin(client, eventId, unit1);
      }

      matches.push(matchRes.rows[0]);
    }
  } else {
    // Round 2+: winners from previous round's matches advance
    // Matches are paired by bracket position: match[0] winner vs match[1] winner, etc.
    const prevMatches = await client.query(
      `SELECT em.* FROM event_matches em
       JOIN event_rounds er ON em.round_id = er.id
       WHERE er.event_id = $1 AND er.round_number = $2
       ORDER BY em.id`,
      [eventId, nextRound - 1]
    );

    const prevResults = prevMatches.rows;

    // Determine winning unit from each match
    const winners: PairingUnit[] = [];
    for (const m of prevResults) {
      if (!m.reported) throw new Error(`Previous round has unreported matches`);
      let repId: number;
      let teamId: number | null = null;
      if (m.player2_id === null) {
        repId = m.player1_id;
        teamId = m.team1_id;
      } else if (m.player1_wins > m.player2_wins) {
        repId = m.player1_id;
        teamId = m.team1_id;
      } else if (m.player2_wins > m.player1_wins) {
        repId = m.player2_id;
        teamId = m.team2_id;
      } else {
        // Draw in single elimination — shouldn't happen, but default to player1
        repId = m.player1_id;
        teamId = m.team1_id;
      }
      winners.push({ repId, teamId, partnerId: isTwoHeadedGiant ? partnerOf(teamPartners, teamId, repId) : null });
    }

    // Pair winners: [0] vs [1], [2] vs [3], etc.
    for (let i = 0; i < winners.length; i += 2) {
      const unit1 = winners[i];
      const unit2 = i + 1 < winners.length ? winners[i + 1] : null;

      const isBye = unit2 === null;
      const matchRes = await client.query(
        `INSERT INTO event_matches (round_id, event_id, player1_id, player2_id, team1_id, team2_id, reported)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [round.id, eventId, unit1.repId, unit2?.repId ?? null, unit1.teamId, unit2?.teamId ?? null, isBye]
      );

      if (isBye) {
        await client.query(
          `UPDATE event_matches SET player1_wins = 2, player2_wins = 0, reported = TRUE WHERE id = $1`,
          [matchRes.rows[0].id]
        );
        await awardByeWin(client, eventId, unit1);
      }

      matches.push(matchRes.rows[0]);
    }
  }
}

export async function reportMatchResult(
  matchId: number,
  player1Wins: number,
  player2Wins: number,
  matchDraws: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matchRes = await client.query(
      `SELECT * FROM event_matches WHERE id = $1 FOR UPDATE`,
      [matchId]
    );
    const match = matchRes.rows[0];
    if (!match) throw new Error('Match not found');
    if (!match.player2_id) throw new Error('Cannot report a bye match');

    // Resolve 2HG partner ids (null for regular single-player matches)
    const teamPartners = (match.team1_id || match.team2_id) ? await getTeamPartnerMap(client, match.event_id) : new Map();
    const partner1 = partnerOf(teamPartners, match.team1_id, match.player1_id);
    const partner2 = partnerOf(teamPartners, match.team2_id, match.player2_id);

    // If already reported, reverse old stats first
    if (match.reported) {
      const oldP1 = match.player1_wins;
      const oldP2 = match.player2_wins;
      if (oldP1 > oldP2) {
        await unbumpWin(client, match.event_id, match.player1_id);
        if (partner1) await unbumpWin(client, match.event_id, partner1);
        await unbumpLoss(client, match.event_id, match.player2_id);
        if (partner2) await unbumpLoss(client, match.event_id, partner2);
      } else if (oldP2 > oldP1) {
        await unbumpWin(client, match.event_id, match.player2_id);
        if (partner2) await unbumpWin(client, match.event_id, partner2);
        await unbumpLoss(client, match.event_id, match.player1_id);
        if (partner1) await unbumpLoss(client, match.event_id, partner1);
      } else {
        await unbumpDraw(client, match.event_id, match.player1_id);
        if (partner1) await unbumpDraw(client, match.event_id, partner1);
        await unbumpDraw(client, match.event_id, match.player2_id);
        if (partner2) await unbumpDraw(client, match.event_id, partner2);
      }
    }

    await client.query(
      `UPDATE event_matches SET player1_wins = $2, player2_wins = $3, draws = $4, reported = TRUE WHERE id = $1`,
      [matchId, player1Wins, player2Wins, matchDraws]
    );

    // Determine match winner
    if (player1Wins > player2Wins) {
      // Player 1 (and partner, if 2HG) wins the match
      await bumpWin(client, match.event_id, match.player1_id);
      if (partner1) await bumpWin(client, match.event_id, partner1);
      await bumpLoss(client, match.event_id, match.player2_id);
      if (partner2) await bumpLoss(client, match.event_id, partner2);
    } else if (player2Wins > player1Wins) {
      // Player 2 (and partner, if 2HG) wins the match
      await bumpWin(client, match.event_id, match.player2_id);
      if (partner2) await bumpWin(client, match.event_id, partner2);
      await bumpLoss(client, match.event_id, match.player1_id);
      if (partner1) await bumpLoss(client, match.event_id, partner1);
    } else {
      // Draw
      await bumpDraw(client, match.event_id, match.player1_id);
      if (partner1) await bumpDraw(client, match.event_id, partner1);
      await bumpDraw(client, match.event_id, match.player2_id);
      if (partner2) await bumpDraw(client, match.event_id, partner2);
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getEventRounds(eventId: number) {
  const result = await pool.query(
    `SELECT * FROM event_rounds WHERE event_id = $1 ORDER BY round_number`,
    [eventId]
  );
  return result.rows;
}

export async function getRoundMatches(eventId: number, roundNumber: number) {
  const result = await pool.query(
    `SELECT em.*, er.round_number,
            u1.name AS player1_name, u2.name AS player2_name,
            u1.nfc_uid AS player1_nfc, u2.nfc_uid AS player2_nfc,
            t1.name AS team1_name, t2.name AS team2_name
     FROM event_matches em
     JOIN event_rounds er ON em.round_id = er.id
     LEFT JOIN users u1 ON em.player1_id = u1.id
     LEFT JOIN users u2 ON em.player2_id = u2.id
     LEFT JOIN event_teams t1 ON em.team1_id = t1.id
     LEFT JOIN event_teams t2 ON em.team2_id = t2.id
     WHERE er.event_id = $1 AND er.round_number = $2
     ORDER BY em.id`,
    [eventId, roundNumber]
  );
  return result.rows;
}

export async function getAllEventMatches(eventId: number) {
  const result = await pool.query(
    `SELECT em.*, er.round_number,
            u1.name AS player1_name, u2.name AS player2_name,
            t1.name AS team1_name, t2.name AS team2_name
     FROM event_matches em
     JOIN event_rounds er ON em.round_id = er.id
     LEFT JOIN users u1 ON em.player1_id = u1.id
     LEFT JOIN users u2 ON em.player2_id = u2.id
     LEFT JOIN event_teams t1 ON em.team1_id = t1.id
     LEFT JOIN event_teams t2 ON em.team2_id = t2.id
     WHERE er.event_id = $1
     ORDER BY er.round_number, em.id`,
    [eventId]
  );
  return result.rows;
}

// --- Set Results (keep for manual override) ---

export async function setParticipantResult(eventId: number, userId: number, position: number) {
  const result = await pool.query(
    `UPDATE event_participants SET result_position = $3
     WHERE event_id = $1 AND user_id = $2
     RETURNING *`,
    [eventId, userId, position]
  );
  if (result.rows.length === 0) throw new Error('Participant not found');
  return result.rows[0];
}

// --- Finish Event + Distribute Prizes by W/L Record ---

export async function finishEvent(eventId: number, createdBy: string = 'system', tieScenario?: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT e.*, et.prize_structure, et.prize_structure_ties, et.tournament_structure, et.team_mode
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status = 'ongoing'
       FOR UPDATE`,
      [eventId]
    );

    const event = eventRes.rows[0];
    if (!event) throw new Error('Event not found or not ongoing');
    const isTwoHeadedGiant = event.team_mode === '2hg';

    const participants = await client.query(
      `SELECT user_id, wins, losses, draws, match_points FROM event_participants WHERE event_id = $1`,
      [eventId]
    );

    // Determine if any player has ties
    const hasTies = participants.rows.some((p: any) => p.draws > 0);

    const tiesStructure: Record<string, PrizeEntry> = event.prize_structure_ties || {};
    const noTiesStructure: Record<string, PrizeEntry> = event.prize_structure || {};
    const hasTiesVariant = Object.keys(tiesStructure).length > 0;

    // For 3-round Swiss events, split the prize_structure_ties by draw count and pick the right scenario
    const is3Round = event.total_rounds === 3 && event.tournament_structure !== 'single_elimination';
    let prizeStructure: Record<string, PrizeEntry>;
    if (tieScenario && tieScenario !== 'no_ties' && hasTiesVariant && is3Round) {
      const drawCount = tieScenario === '1_draw' ? 1 : tieScenario === '2_draws' ? 2 : 3;
      prizeStructure = {};
      for (const [rec, entry] of Object.entries(tiesStructure)) {
        const parts = rec.split('-');
        const t = parseInt(parts[2] ?? '0');
        if (t === drawCount) prizeStructure[rec] = entry;
      }
    } else if (tieScenario === 'no_ties' || !hasTies || !hasTiesVariant) {
      prizeStructure = noTiesStructure;
    } else {
      prizeStructure = (hasTies && hasTiesVariant) ? tiesStructure : noTiesStructure;
    }

    const prizes: Array<{ userId: number; record: string; amount: number; specialVoucherId?: number | null }> = [];
    const specialVoucherService = await import('./specialVoucherService');

    // For 2HG events, rank by team (both members share identical mirrored stats) so
    // partners land on the same placement instead of adjacent positions.
    let rankingRows = participants.rows;
    let teamOfUser = new Map<number, number>();
    if (isTwoHeadedGiant) {
      const teamsRes = await client.query(`SELECT id, member1_id, member2_id FROM event_teams WHERE event_id = $1`, [eventId]);
      for (const t of teamsRes.rows) {
        teamOfUser.set(t.member1_id, t.id);
        teamOfUser.set(t.member2_id, t.id);
      }
      const seenTeams = new Set<number>();
      rankingRows = participants.rows.filter((p: any) => {
        const teamId = teamOfUser.get(p.user_id);
        if (!teamId || seenTeams.has(teamId)) return false;
        seenTeams.add(teamId);
        return true;
      });
    }

    // Assign positions by match_points
    const sorted = [...rankingRows].sort((a: any, b: any) => b.match_points - a.match_points || b.wins - a.wins);
    for (let i = 0; i < sorted.length; i++) {
      await client.query(
        `UPDATE event_participants SET result_position = $3 WHERE event_id = $1 AND user_id = $2`,
        [eventId, sorted[i].user_id, i + 1]
      );
      if (isTwoHeadedGiant) {
        const teamId = teamOfUser.get(sorted[i].user_id);
        const teamRow = (await client.query(`SELECT member1_id, member2_id FROM event_teams WHERE id = $1`, [teamId])).rows[0];
        const partnerId = teamRow.member1_id === sorted[i].user_id ? teamRow.member2_id : teamRow.member1_id;
        await client.query(
          `UPDATE event_participants SET result_position = $3 WHERE event_id = $1 AND user_id = $2`,
          [eventId, partnerId, i + 1]
        );
      }
    }

    // Check if prize structure uses placement keys (Commander: 1st, 2nd, 3rd, 4th)
    const placementSuffixes = ['st', 'nd', 'rd', 'th'];
    const isPlacementBased = Object.keys(prizeStructure).some(k => placementSuffixes.some(s => k.endsWith(s)));

    async function awardPrizeEntry(userId: number, key: string, entry: PrizeEntry | undefined) {
      const reward = prizeTixAmount(entry);
      const specialVoucherId = prizeSpecialVoucherId(entry);
      let memberReward = 0;

      if (reward > 0) {
        memberReward = isTwoHeadedGiant ? Math.ceil(reward / 2) : reward;
        await addTransaction({
          userId,
          type: 'tix',
          amount: memberReward,
          reason: 'prize',
          eventId,
          createdBy,
          client,
          conventionId: event.convention_id,
        });
      }

      if (specialVoucherId) {
        await specialVoucherService.awardSpecialVoucherAsPrize(client, specialVoucherId, userId, eventId, createdBy);
      }

      if (memberReward > 0 || specialVoucherId) {
        prizes.push({ userId, record: key, amount: memberReward, specialVoucherId });
      }
    }

    if (isPlacementBased) {
      // Award tix/special vouchers by final position (Commander style)
      for (let i = 0; i < sorted.length; i++) {
        const pos = i + 1;
        const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
        const key = `${pos}${suffix}`;
        const entry = prizeStructure[key];

        if (isTwoHeadedGiant) {
          const teamId = teamOfUser.get(sorted[i].user_id);
          const teamRow = (await client.query(`SELECT member1_id, member2_id FROM event_teams WHERE id = $1`, [teamId])).rows[0];
          await awardPrizeEntry(teamRow.member1_id, key, entry);
          await awardPrizeEntry(teamRow.member2_id, key, entry);
        } else {
          await awardPrizeEntry(sorted[i].user_id, key, entry);
        }
      }
    } else {
      // Award tix/special vouchers based on W-L-T record (Swiss style)
      for (const p of participants.rows) {
        const recordNoTies = `${p.wins}-${p.losses}`;
        const recordWithTies = `${p.wins}-${p.losses}-${p.draws}`;

        // Try exact W-L-T first, then W-L
        const entry = prizeStructure[recordWithTies] ?? prizeStructure[recordNoTies];
        await awardPrizeEntry(p.user_id, recordWithTies, entry);
      }
    }

    await client.query(
      `UPDATE events SET status = 'finished', finished_at = NOW() WHERE id = $1`,
      [eventId]
    );

    await client.query('COMMIT');
    return { success: true, prizes };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Cancel Event + Refund (with DB transaction) ---

export async function cancelEvent(eventId: number, createdBy: string = 'system') {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const eventRes = await client.query(
      `SELECT e.*, et.entry_cost_vouchers
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1 AND e.status IN ('open', 'ongoing')
       FOR UPDATE`,
      [eventId]
    );

    const event = eventRes.rows[0];
    if (!event) throw new Error('Event not found or already finished/cancelled');

    // Refund all participants
    const participants = await client.query(
      `SELECT user_id FROM event_participants WHERE event_id = $1`,
      [eventId]
    );

    for (const p of participants.rows) {
      await addTransaction({
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

    await client.query(
      `UPDATE events SET status = 'cancelled' WHERE id = $1`,
      [eventId]
    );

    await client.query('COMMIT');
    return { success: true, refundedCount: participants.rows.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
