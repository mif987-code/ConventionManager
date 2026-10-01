import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../config/db';

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

export default router;
