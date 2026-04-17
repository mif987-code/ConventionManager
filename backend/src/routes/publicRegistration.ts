import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

const router = Router();

// Simple in-memory rate limiter per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10; // max 10 registrations per window per IP

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many registrations. Please try again later.' });
  }

  entry.count++;
  return next();
}

// POST /public/preregister - Public pre-registration (no API key needed)
router.post('/preregister', rateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, last_name, email, age, dob, attendance_dates, package_id, event_prereg_ids } = req.body;

    if (!name || !last_name || !email) {
      return res.status(400).json({ error: 'name, last_name, and email are required' });
    }

    // Check if email already registered
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // Get active convention, fall back to most recent convention
    let convRes = await pool.query(
      `SELECT id FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );
    let conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;

    // If no active convention, try to get the most recent convention
    if (!conventionId) {
      convRes = await pool.query(
        `SELECT id FROM conventions ORDER BY created_at DESC LIMIT 1`
      );
      conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;
    }

    if (!conventionId) {
      return res.status(400).json({ error: 'No convention found. Please create a convention in the admin panel first.' });
    }

    const result = await pool.query(
      `INSERT INTO users (name, last_name, email, age, dob, is_preregistered, convention_id)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, name, last_name, email, age, dob, is_preregistered, created_at`,
      [name, last_name, email, age || null, dob || null, conventionId]
    );

    // Insert attendance dates if provided
    const userId = result.rows[0].id;
    if (attendance_dates && Array.isArray(attendance_dates) && attendance_dates.length > 0) {
      for (const dateStr of attendance_dates) {
        await pool.query(
          `INSERT INTO user_attendance (user_id, convention_id, attendance_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, convention_id, attendance_date) DO NOTHING`,
          [userId, conventionId, dateStr]
        );
      }
    }

    // Insert package selection if provided
    if (package_id) {
      await pool.query(
        `INSERT INTO user_packages (user_id, convention_id, package_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, convention_id) DO UPDATE SET package_id = $3`,
        [userId, conventionId, package_id]
      );

      // Get package details to award vouchers
      const packageRes = await pool.query(
        `SELECT regular_voucher_amount FROM packages WHERE id = $1`,
        [package_id]
      );

      if (packageRes.rows.length > 0) {
        const pkg = packageRes.rows[0];

        // Award regular vouchers
        if (pkg.regular_voucher_amount > 0) {
          await pool.query(
            `INSERT INTO voucher_transactions (user_id, amount, description)
             VALUES ($1, $2, $3)`,
            [userId, pkg.regular_voucher_amount, `Package registration bonus`]
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

        // Award special vouchers
        for (const sv of specialVouchersRes.rows) {
          await pool.query(
            `INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
             VALUES ($1, $2, NULL, 'package_registration')`,
            [userId, sv.id]
          );
        }
      }
    }

    // Insert event pre-registrations if provided
    if (event_prereg_ids && Array.isArray(event_prereg_ids) && event_prereg_ids.length > 0) {
      for (const eventId of event_prereg_ids) {
        await pool.query(
          `INSERT INTO event_participants (user_id, event_id, preregistered)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id, event_id) DO UPDATE SET preregistered = true`,
          [userId, eventId]
        );
      }
    }

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /public/preregister/check?email=... - Check if email already registered
router.get('/preregister/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    res.json({ registered: existing.rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

// GET /public/convention - Get active convention info
router.get('/convention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching convention info...');
    let convRes = await pool.query(
      `SELECT id, name, start_date, end_date, scan_mode FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );

    // If no active convention, try to get the most recent convention
    if (convRes.rows.length === 0) {
      console.log('No active convention, fetching most recent...');
      convRes = await pool.query(
        `SELECT id, name, start_date, end_date, scan_mode FROM conventions ORDER BY created_at DESC LIMIT 1`
      );
    }

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: 'No convention found. Please create a convention in the admin panel first.' });
    }

    const convention = convRes.rows[0];
    console.log('Convention found:', convention.id, convention.name);

    // Calculate available dates
    const dates: string[] = [];
    if (convention.start_date && convention.end_date) {
      const current = new Date(convention.start_date);
      const end = new Date(convention.end_date);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    console.log('Available dates:', dates.length);

    // Get packages for this convention
    console.log('Fetching packages for convention:', convention.id);
    const packagesRes = await pool.query(
      `SELECT * FROM packages WHERE convention_id = $1 AND is_active = TRUE ORDER BY days ASC, cost ASC`,
      [convention.id]
    );
    console.log('Packages found:', packagesRes.rows.length);

    // Get events with preregistration enabled (handle if column doesn't exist)
    console.log('Fetching events for convention:', convention.id);
    let eventsRes;
    try {
      eventsRes = await pool.query(
        `SELECT e.id, e.name, et.max_players, et.entry_cost_vouchers FROM events e
         JOIN event_types et ON e.event_type_id = et.id
         WHERE e.convention_id = $1 AND e.preregistration_enabled = TRUE
         ORDER BY e.created_at ASC`,
        [convention.id]
      );
      console.log('Events found:', eventsRes.rows.length);
    } catch (err) {
      // If preregistration_enabled column doesn't exist, return empty events
      console.error('Error querying events (preregistration_enabled column may not exist):', err);
      eventsRes = { rows: [] };
    }

    res.json({ convention, available_dates: dates, packages: packagesRes.rows, events: eventsRes.rows });
  } catch (err) {
    console.error('Error in /public/convention:', err);
    next(err);
  }
});

export default router;
