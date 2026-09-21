import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'crypto';
import { pool } from '../config/db';
import * as userService from '../services/userService';
import * as storeService from '../services/storeService';
import * as eventService from '../services/eventService';
import { sendPasswordResetEmail, sendQRCodeEmail } from '../services/emailService';
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
  message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.' },
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
    return res.status(401).json({ error: 'Token ausente o inválido' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number };
    (req as any).playerId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
}

// =============================================
//  PUBLIC (no auth)
// =============================================

router.get('/auth/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let result = await pool.query(`SELECT scan_mode FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);
    if (result.rows.length === 0) result = await pool.query(`SELECT scan_mode FROM conventions ORDER BY created_at DESC LIMIT 1`);
    res.json({ scan_mode: result.rows[0]?.scan_mode || 'qr' });
  } catch (err) { next(err); }
});

router.post('/auth/forgot-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'El correo electrónico es obligatorio' });

    const result = await pool.query(`SELECT id, name, last_name, email FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
    const user = result.rows[0];
    if (user) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
      await pool.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`, [user.id, tokenHash]);
      const appUrl = process.env.PLAYER_APP_URL || 'https://register.sparkfestcr.com/app/';
      const resetUrl = `${appUrl}${appUrl.includes('?') ? '&' : '?'}reset=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(user.email, `${user.name}${user.last_name ? ` ${user.last_name}` : ''}`, resetUrl);
    }

    res.json({ success: true, message: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.' });
  } catch (err) { next(err); }
});

router.post('/auth/reset-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const resetToken = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!resetToken || password.length < 8) return res.status(400).json({ error: 'El enlace y una contraseña de al menos 8 caracteres son obligatorios' });

    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`,
      [tokenHash]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El enlace es inválido o ha vencido' });
    }
    const hash = await bcrypt.hash(password, 10);
    await client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, result.rows[0].user_id]);
    await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, [result.rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

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
    if (!email || !password) return res.status(400).json({ error: 'El correo y la contraseña son obligatorios' });

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No existe un jugador con ese correo' });
    if (!user.password_hash) return res.status(400).json({ error: 'La contraseña no está configurada. Solicita ayuda a un organizador.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

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
      const convRes = await pool.query(`SELECT id, name, scan_mode FROM conventions WHERE id = $1`, [user.convention_id]);
      if (convRes.rows.length > 0) {
        convention = convRes.rows[0];
      }
    }

    // Get active (unconsumed) special vouchers held by the player
    const specialVouchersRes = await pool.query(
      `SELECT sva.id AS award_id, sva.awarded_at, sv.id AS voucher_id, sv.name, sv.category, sv.format, sv.icon, sv.color, sv.description
       FROM special_voucher_awards sva
       JOIN special_vouchers sv ON sv.id = sva.special_voucher_id
       WHERE sva.user_id = $1 AND sva.consumed_at IS NULL
       ORDER BY sva.awarded_at DESC`,
      [userId]
    );

    // Get merchandise items for the player
    const merchandiseRes = await pool.query(
      `SELECT id, item_name, image_url, is_claimed, claimed_at
       FROM user_merchandise
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    // Get wallet credit history for the player
    let creditHistory = [];
    if (user.convention_id) {
      creditHistory = await walletService.getHistory(userId, user.convention_id, 20, 0);
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
        special_vouchers: specialVouchersRes.rows,
        merchandise: merchandiseRes.rows,
        credit_history: creditHistory,
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
    if (!password || password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
});

// POST /player/regenerate-qr - Regenerate QR code
router.post('/regenerate-qr', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    
    // Generate new QR code
    const updatedUser = await userService.regenerateQRCode(userId);
    
    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (action, details, user_id) VALUES ($1, $2, $3)`,
      ['qr_regenerated', `User ${userId} regenerated their QR code via player app`, userId]
    );

    // Send email with new QR code
    if (updatedUser?.email && updatedUser?.qr_code) {
      sendQRCodeEmail(updatedUser.email, updatedUser.name, updatedUser.qr_code).catch(err =>
        console.error('[EmailService] Background QR regenerate email error:', err)
      );
    }
    
    res.json({ success: true, qr_code: updatedUser.qr_code, message: 'QR code regenerated' });
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
    const userRes = await pool.query(`SELECT convention_id FROM users WHERE id = $1`, [userId]);
    const conventionId = userRes.rows[0]?.convention_id;
    if (!conventionId) return res.json({ success: true, events: [] });

    const events = await eventService.getAllEvents('open', conventionId);

    // Mark which events the player is already registered for
    const regResult = await pool.query(
      `SELECT event_id, preregistered FROM event_participants WHERE user_id = $1`,
      [userId]
    );
    const registeredMap = new Map(regResult.rows.map((r: any) => [r.event_id, r.preregistered]));

    // Unconsumed special vouchers that could cover an entry
    const voucherRes = await pool.query(
      `SELECT sv.category, sv.format
       FROM special_voucher_awards sva
       JOIN special_vouchers sv ON sv.id = sva.special_voucher_id
       WHERE sva.user_id = $1 AND sv.convention_id = $2 AND sva.consumed_at IS NULL`,
      [userId, conventionId]
    );
    const vouchers = voucherRes.rows;

    const enriched = events.map((ev: any) => ({
      ...ev,
      already_registered: registeredMap.has(ev.id),
      preregistered_by_me: registeredMap.get(ev.id) === true,
      covered_by_voucher: vouchers.some((v: any) =>
        Boolean(v.category) &&
        Boolean(ev.category) &&
        v.category === ev.category &&
        (v.format === null || v.format === undefined || v.format === '' || v.format === ev.format)
      ),
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

// DELETE /player/events/:id/register - Unregister from an event and refund wallet credit or restore special voucher
router.delete('/events/:id/register', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const eventId = parseInt(req.params.id);
    const result = await eventService.unregisterFromEvent(userId, eventId, `player:${userId}`, true);
    res.json(result);
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
