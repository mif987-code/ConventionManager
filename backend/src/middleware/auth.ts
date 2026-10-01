import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../services/userService';
import { PermissionCategory } from '../services/permissionService';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  console.error('[Auth] JWT_SECRET environment variable is required');
  process.exit(1);
}

export function conventionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers['x-convention-id'] as string | undefined;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      req.conventionId = parsed;
    }
  }
  next();
}

// Validates either a master API key or a signed admin JWT.
export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const validKey = process.env.API_KEY;

  if (apiKey && validKey && apiKey === validKey) {
    // Master API key = super admin
    req.isAdmin = true;
    req.adminPermissions = ['super'];
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as { userId: number; role?: string };
      if (decoded.role !== 'admin') {
        throw new Error('Not an admin token');
      }
      const user = await getUserById(decoded.userId);
      if (!user || !user.is_admin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }
      req.isAdmin = true;
      req.adminId = user.id;
      req.adminPermissions = user.admin_permissions || [];
      return next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired admin token' });
      return;
    }
  }

  res.status(403).json({ error: 'Unauthorized: Invalid API key or admin token' });
}

// Rejects requests from non-admin callers.
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Enforces a permission category. Super admins bypass.
export function requirePermission(permission: PermissionCategory) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms = req.adminPermissions || [];
    if (perms.includes('super') || perms.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: `Permission required: ${permission}` });
  };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);
  res.status(400).json({ error: err.message || 'An unexpected error occurred' });
}
