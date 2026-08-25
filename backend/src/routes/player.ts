import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../config/db';
import * as userService from '../services/userService';
import * as storeService from '../services/storeService';
import * as eventService from '../services/eventService';
import { getBalance } from '../services/transactionService';
import * as walletService from '../services/walletService';
import { syncPreregistrationToSheet } from '../services/googleSheetsService';

const router = Router();

// Login attempts are CPU-expensive (bcrypt.compare) and unauthenticated, so a
// flood of requests here can pin the server's CPU far more effectively than
// most other endpoints. Cap attempts per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

if (!process.env.JWT_SECRET) {
  console.error('[Auth] JWT_SECRET environment variable is required');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// --- JWT helper ---
function signToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// --- JWT auth middleware for player routes ---
function playerAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number };
    (req as any).playerId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// =============================================
//  PUBLIC (no auth)
// =============================================

// POST /player/auth/nfc - Login by NFC UID
router.post('/auth/nfc', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nfc_uid } = req.body;
    if (!nfc_uid) return res.status(400).json({ error: 'nfc_uid is required' });

    const user = await userService.getUserByNfcUid(nfc_uid);
    if (!user) return res.status(404).json({ error: 'No player found with that NFC tag' });

    const token = signToken(user.id);
    const voucherBalance = await getBalance(user.id, 'voucher');
    const tixBalance = await getBalance(user.id, 'tix');

    res.json({
      success: true, token,
      player: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, nfc_uid: user.nfc_uid, voucher_balance: voucherBalance, tix_balance: tixBalance },
    });
  } catch (err) { next(err); }
});

// POST /player/auth/login - Login by email + password
router.post('/auth/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No player found with that email' });
    if (!user.password_hash) return res.status(400).json({ error: 'Password not set. Please ask an organizer or use NFC login.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const token = signToken(user.id);
    const voucherBalance = await getBalance(user.id, 'voucher');
    const tixBalance = await getBalance(user.id, 'tix');

    res.json({
      success: true, token,
      player: { id: user.id, name: user.name, last_name: user.last_name, email: user.email, nfc_uid: user.nfc_uid, voucher_balance: voucherBalance, tix_balance: tixBalance },
    });
  } catch (err) { next(err); }
});

// =============================================
//  PROTECTED (JWT required)
// =============================================

// GET /player/me - Get own profile + balances
router.get('/me', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const user = await userService.getUserWithBalances(userId);
    if (!user) return res.status(404).json({ error: 'Player not found' });

    // Get convention info
    let convention = null;
    if (user.convention_id) {
      const convRes = await pool.query(`SELECT id, name FROM conventions WHERE id = $1`, [user.convention_id]);
      if (convRes.rows.length > 0) {
        convention = convRes.rows[0];
      }
    }

    res.json({
      success: true,
      player: {
        id: user.id, name: user.name, last_name: user.last_name, email: user.email,
        nfc_uid: user.nfc_uid, age: user.age, dob: user.dob, days_playing: user.days_playing,
        voucher_balance: user.voucher_balance, tix_balance: user.tix_balance,
        credit_balance: user.credit_balance,
        qr_code: user.qr_code,
        created_at: user.created_at,
      },
      convention,
    });
  } catch (err) { next(err); }
});

// PUT /player/me/password - Set / update password
router.put('/me/password', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

// POST /player/regenerate-qr - Regenerate QR code
router.post('/regenerate-qr', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    
    // Generate new QR code
    const newQrCode = await userService.regenerateQRCode(userId);
    
    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (action, details, user_id) VALUES ($1, $2, $3)`,
      ['qr_regenerated', `User ${userId} regenerated their QR code via player app`, userId]
    );
    
    res.json({ success: true, qr_code: newQrCode, message: 'QR code regenerated' });
  } catch (err) { next(err); }
});

// GET /player/events - Get own event history
router.get('/events', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const result = await pool.query(
      `SELECT ep.*, e.name AS event_name, e.status, e.created_at AS event_date,
              et.name AS event_type_name, et.category, et.tournament_structure,
              e.current_round, e.total_rounds, e.table_number
       FROM event_participants ep
       JOIN events e ON ep.event_id = e.id
       JOIN event_types et ON e.event_type_id = et.id
       WHERE ep.user_id = $1
       ORDER BY e.created_at DESC`,
      [userId]
    );
    res.json({ success: true, events: result.rows });
  } catch (err) { next(err); }
});

// GET /player/events/:id - Get detailed event view (standings, own matches)
router.get('/events/:id', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);
    const event = await eventService.getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const participants = await eventService.getEventParticipants(eventId);
    const matches = await eventService.getAllEventMatches(eventId);
    const myMatches = matches.filter((m: any) => m.player1_id === userId || m.player2_id === userId);

    res.json({ success: true, event, participants, my_matches: myMatches });
  } catch (err) { next(err); }
});

// GET /player/upcoming-events - List open events the player can join
router.get('/upcoming-events', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const events = await eventService.getAllEvents('open');

    // Mark which events the player is already registered for
    const regResult = await pool.query(
      `SELECT event_id FROM event_participants WHERE user_id = $1`,
      [userId]
    );
    const registeredSet = new Set(regResult.rows.map((r: any) => r.event_id));

    const enriched = events.map((ev: any) => ({
      ...ev,
      already_registered: registeredSet.has(ev.id),
    }));

    res.json({ success: true, events: enriched });
  } catch (err) { next(err); }
});

// POST /player/events/:id/register - Self-register for an event
router.post('/events/:id/register', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);
    const result = await eventService.registerToEvent(userId, eventId, `player:${userId}`);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /player/events/:id/register - Unregister from an event and refund wallet credit
router.delete('/events/:id/register', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);

    const partRes = await pool.query(
      `SELECT ep.id, ep.wins, ep.losses, ep.draws, ep.result_position, e.convention_id, et.category, et.entry_cost_colones
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       JOIN event_types et ON et.id = e.event_type_id
       WHERE ep.event_id = $1 AND ep.user_id = $2`,
      [eventId, userId]
    );
    const participant = partRes.rows[0];
    if (!participant) return res.status(404).json({ error: 'You are not registered for this event' });

    const hasPlayed = participant.wins > 0 || participant.losses > 0 || participant.draws > 0 || participant.result_position !== null;
    if (hasPlayed) return res.status(400).json({ error: 'Cannot unregister — this event has already started for you' });

    const costColones = participant.entry_cost_colones || 0;
    if (costColones > 0 && participant.category !== 'On Demand') {
      // Refund the original payment amount if a charge exists.
      const txRes = await pool.query(
        `SELECT amount_colones FROM wallet_transactions
         WHERE user_id = $1 AND related_event_id = $2 AND type = 'event_entry' AND amount_colones < 0
         ORDER BY created_at
         LIMIT 1`,
        [userId, eventId]
      );
      if (txRes.rows.length > 0) {
        await walletService.refund(
          userId,
          participant.convention_id,
          Math.abs(txRes.rows[0].amount_colones),
          `player:${userId}`,
          eventId,
          'event_refund'
        );
      }
    }

    await pool.query(`DELETE FROM event_participants WHERE id = $1`, [participant.id]);
    res.json({ success: true, message: 'Unregistered and refunded' });
  } catch (err) { next(err); }
});

// GET /player/preregistrations - List events open for pre-registration in the
// player's convention (regardless of 'open' status), flagging which ones the
// player has already pre-registered for.
router.get('/preregistrations', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const userRes = await pool.query(`SELECT convention_id FROM users WHERE id = $1`, [userId]);
    const conventionId = userRes.rows[0]?.convention_id;
    if (!conventionId) return res.json({ success: true, events: [] });

    const result = await pool.query(
      `SELECT e.id, e.name, e.status, e.schedule_day, e.start_time, e.end_time, e.track,
              et.name AS event_type_name, et.category, et.format, et.max_players, et.entry_cost_vouchers, et.entry_cost_colones,
              (ep.id IS NOT NULL AND ep.preregistered = TRUE) AS preregistered_by_me,
              (SELECT COUNT(*)::int FROM event_participants ep2 WHERE ep2.event_id = e.id AND ep2.preregistered = TRUE) AS preregistered_count
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       LEFT JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = $1
       WHERE e.convention_id = $2 AND e.preregistration_enabled = TRUE AND e.status != 'cancelled'
       ORDER BY e.schedule_day ASC NULLS LAST, e.start_time ASC NULLS LAST, e.name ASC`,
      [userId, conventionId]
    );

    res.json({ success: true, events: result.rows });
  } catch (err) { next(err); }
});

// POST /player/preregistrations/:id - Pre-register for an event (no voucher cost, mirrors public site)
router.post('/preregistrations/:id', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);

    const eventRes = await pool.query(
      `SELECT e.id, e.name AS event_name, e.preregistration_enabled, e.status, e.convention_id,
              u.convention_id AS user_convention_id, u.name AS user_name, u.last_name AS user_last_name, u.email AS user_email
       FROM events e, users u
       WHERE e.id = $1 AND u.id = $2`,
      [eventId, userId]
    );
    const row = eventRes.rows[0];
    if (!row) return res.status(404).json({ error: 'Event not found' });
    if (!row.preregistration_enabled) return res.status(400).json({ error: 'Pre-registration is not enabled for this event' });
    if (row.status === 'cancelled') return res.status(400).json({ error: 'This event has been cancelled' });
    if (row.convention_id !== row.user_convention_id) return res.status(403).json({ error: 'This event is not part of your convention' });

    await pool.query(
      `INSERT INTO event_participants (user_id, event_id, preregistered, convention_id)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET preregistered = true`,
      [userId, eventId, row.convention_id]
    );

    await syncPreregistrationToSheet(row.event_name, `${row.user_name} ${row.user_last_name}`.trim(), row.user_email);

    res.json({ success: true, message: 'Pre-registered successfully' });
  } catch (err) { next(err); }
});

// DELETE /player/preregistrations/:id - Cancel a pre-registration (only before the player has actually played)
router.delete('/preregistrations/:id', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);

    const partRes = await pool.query(
      `SELECT id, wins, losses, draws, result_position FROM event_participants WHERE event_id = $1 AND user_id = $2 AND preregistered = TRUE`,
      [eventId, userId]
    );
    const participant = partRes.rows[0];
    if (!participant) return res.status(404).json({ error: 'You are not pre-registered for this event' });

    const hasPlayed = participant.wins > 0 || participant.losses > 0 || participant.draws > 0 || participant.result_position !== null;
    if (hasPlayed) return res.status(400).json({ error: 'Cannot cancel — this event has already started for you' });

    await pool.query(`DELETE FROM event_participants WHERE id = $1`, [participant.id]);
    res.json({ success: true, message: 'Pre-registration cancelled' });
  } catch (err) { next(err); }
});

// GET /player/store/items - List active store items
router.get('/store/items', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await storeService.getAllItems(true);
    res.json({ success: true, items });
  } catch (err) { next(err); }
});

// POST /player/store/purchase - Purchase item
router.post('/store/purchase', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const { item_id, quantity } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id is required' });
    const result = await storeService.purchaseItem(userId, item_id, quantity || 1);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /player/store/orders - Get own orders
router.get('/store/orders', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const orders = await storeService.getUserOrders(userId);
    res.json({ success: true, orders });
  } catch (err) { next(err); }
});

// GET /player/collection - Get all collectibles for current convention with earned status
router.get('/collection', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    // Derive convention_id from the convention active for the player's registration
    const convRes = await pool.query(
      `SELECT DISTINCT e.convention_id FROM event_participants ep
       JOIN events e ON e.id = ep.event_id WHERE ep.user_id = $1 ORDER BY 1 DESC LIMIT 1`,
      [userId]
    );
    const conventionId = convRes.rows[0]?.convention_id ?? null;

    const allRes = await pool.query(
      `SELECT c.*,
        (SELECT earned_at FROM player_collectibles pc WHERE pc.collectible_id = c.id AND pc.user_id = $1 LIMIT 1) AS earned_at
       FROM collectibles c
       WHERE c.convention_id = $2
       ORDER BY c.created_at ASC`,
      [userId, conventionId]
    );

    const setsRes = await pool.query(
      `SELECT cs.*, COALESCE(json_agg(csi.collectible_id) FILTER (WHERE csi.collectible_id IS NOT NULL), '[]') AS collectible_ids
       FROM collection_sets cs
       LEFT JOIN collection_set_items csi ON csi.set_id = cs.id
       WHERE cs.convention_id = $1
       GROUP BY cs.id ORDER BY cs.created_at ASC`,
      [conventionId]
    );

    res.json({ success: true, collectibles: allRes.rows, sets: setsRes.rows });
  } catch (err) { next(err); }
});

export default router;
