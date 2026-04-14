import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import * as userService from '../services/userService';
import * as storeService from '../services/storeService';
import * as eventService from '../services/eventService';
import { getBalance } from '../services/transactionService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_JWT_SECRET_HERE';

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
router.post('/auth/nfc', async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
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

    res.json({
      success: true,
      player: {
        id: user.id, name: user.name, last_name: user.last_name, email: user.email,
        nfc_uid: user.nfc_uid, age: user.age, dob: user.dob, days_playing: user.days_playing,
        voucher_balance: user.voucher_balance, tix_balance: user.tix_balance,
        created_at: user.created_at,
      },
    });
  } catch (err) { next(err); }
});

// PUT /player/me/password - Set / update password
router.put('/me/password', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

// GET /player/events - Get own event history
router.get('/events', playerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).playerId;
    const result = await pool.query(
      `SELECT ep.*, e.name AS event_name, e.status, e.created_at AS event_date,
              et.name AS event_type_name, et.category, et.tournament_structure,
              e.current_round, e.total_rounds
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

export default router;
