import { Router, Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { addTransaction } from '../services/transactionService';
import { generateQRToken } from '../services/qrTokenService';
import { pool } from '../config/db';

const router = Router();

// POST /api/users/register - Register a new user (NFC optional)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, nfc_uid, email, is_admin, attendance_dates, package_id } = req.body;
    const { conventionId } = req;

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

    // Insert package selection if provided
    if (package_id && conventionId) {
      await pool.query(
        `INSERT INTO user_packages (user_id, convention_id, package_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, convention_id) DO UPDATE SET package_id = $3`,
        [user.id, conventionId, package_id]
      );

      // Get package details to check if payment is required
      const packageRes = await pool.query(
        `SELECT regular_voucher_amount, prereg_cost, cost FROM packages WHERE id = $1`,
        [package_id]
      );

      if (packageRes.rows.length > 0) {
        const pkg = packageRes.rows[0];
        const packageCost = pkg.prereg_cost || pkg.cost;

        // Only award vouchers if package has no cost (free package)
        if (packageCost === 0 && pkg.regular_voucher_amount > 0) {
          await pool.query(
            `INSERT INTO voucher_transactions (user_id, amount, description)
             VALUES ($1, $2, $3)`,
            [user.id, pkg.regular_voucher_amount, `Package registration bonus`]
          );
        }

        // Get special vouchers for this package
        const specialVouchersRes = await pool.query(
          `SELECT sv.id, sv.amount, sv.name
           FROM package_special_vouchers psv
           JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
           WHERE psv.package_id = $1`,
          [package_id]
        );

        // Award special vouchers only if package is free
        if (packageCost === 0) {
          for (const sv of specialVouchersRes.rows) {
            await pool.query(
              `INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
               VALUES ($1, $2, NULL, 'package_registration')`,
              [user.id, sv.id]
            );
          }
        }
      }
    }

    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/users - List all users
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
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

    const users = await userService.searchUsers(q, req.conventionId);
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
    const userId = parseInt(req.params.id);
    const { adminId } = req;

    const user = await userService.regenerateQRCode(userId);

    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (action, details, user_id, admin_id) VALUES ($1, $2, $3, $4)`,
      ['qr_regenerated', `Admin regenerated QR code for user ${userId}`, userId, adminId]
    );

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/qr-token - Generate and return QR token for user
router.get('/:id/qr-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const token = await generateQRToken(userId, 24); // 24 hour expiry

    res.json({ success: true, token });
  } catch (err) {
    next(err);
  }
});

export default router;
