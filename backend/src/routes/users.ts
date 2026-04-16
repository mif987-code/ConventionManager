import { Router, Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { addTransaction } from '../services/transactionService';

const router = Router();

// POST /api/users/register - Register a new user (NFC optional)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, nfc_uid, email, is_admin, attendance_dates } = req.body;
    const conventionId = (req as any).conventionId;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (nfc_uid) {
      const existing = await userService.getUserByNfcUid(nfc_uid, conventionId);
      if (existing) {
        return res.status(409).json({ error: 'NFC tag already registered' });
      }
    }

    // Convert attendance dates strings to Date objects
    const dates = attendance_dates ? attendance_dates.map((d: string) => new Date(d)) : undefined;

    const user = await userService.createUser(name, nfc_uid, email, is_admin, conventionId, dates);
    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/users - List all users
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conventionId = (req as any).conventionId;
    const users = await userService.getAllUsers(conventionId);
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/search?q=... - Search users by name or NFC UID
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    const users = await userService.searchUsers(q);
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id - Get user with balances
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserWithBalances(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, nfc_uid, email, days_playing, is_admin } = req.body;
    const user = await userService.updateUser(parseInt(req.params.id), {
      name, nfc_uid, email, days_playing, is_admin,
    });
    if (!user) return res.status(404).json({ error: 'User not found or no changes' });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:id/regenerate-qr - Regenerate QR code for user
router.post('/:id/regenerate-qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.regenerateQRCode(parseInt(req.params.id));
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

export default router;
