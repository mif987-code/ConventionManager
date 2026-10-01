import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'crypto';
import { pool } from '../config/db';
import { createUser } from '../services/userService';
import { setAdminStatus } from '../services/permissionService';
import { sendPasswordResetEmail } from '../services/emailService';
import { adminAuth, requirePermission } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  console.error('[AdminAuth] JWT_SECRET environment variable is required');
  process.exit(1);
}

const router = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
});

// POST /api/admin/login - Admin login by email + password
router.post('/login', adminLoginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'El correo y la contraseña son obligatorios' });
    }

    const result = await pool.query(
      `SELECT id, name, password_hash, is_admin, admin_permissions, deleted_at
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.is_admin || user.deleted_at) {
      return res.status(401).json({ error: 'Credenciales de administrador inválidas' });
    }
    if (!user.password_hash) {
      return res.status(400).json({ error: 'La contraseña no está configurada. Solicita ayuda a un organizador.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ userId: user.id, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      success: true,
      token,
      admin: {
        id: user.id,
        name: user.name,
        permissions: user.admin_permissions || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/invite - Create a new admin and send a password-set email
router.post('/invite', adminAuth, requirePermission('super'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, permissions: requestedPerms } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`, [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }

    const user = await createUser(name.trim(), undefined, email.trim(), true, undefined, undefined);
    const perms = Array.isArray(requestedPerms) ? requestedPerms : [];
    await setAdminStatus(user.id, true, perms);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await pool.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [user.id, tokenHash]);

    const baseUrl = (process.env.APP_URL || 'https://register.sparkfestcr.com').replace(/\/$/, '');
    const resetUrl = `${baseUrl}/admin/?reset=${encodeURIComponent(token)}`;
    const delivered = await sendPasswordResetEmail(user.email!, user.name, resetUrl, true);
    if (!delivered) {
      return res.status(503).json({ error: 'Email could not be delivered. The admin account was created; resend the password email manually.' });
    }

    res.status(201).json({ success: true, admin: { id: user.id, name: user.name, email: user.email, permissions: perms } });
  } catch (err) {
    next(err);
  }
});

export default router;
