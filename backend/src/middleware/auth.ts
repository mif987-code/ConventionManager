import { Request, Response, NextFunction } from 'express';

// Convention ID middleware - extracts convention_id from header and attaches to request
export function conventionMiddleware(req: Request, res: Response, next: NextFunction) {
  const conventionId = req.headers['x-convention-id'] as string;
  console.log('[Convention Middleware] Received x-convention-id header:', conventionId);
  if (conventionId) {
    (req as any).conventionId = parseInt(conventionId);
    console.log('[Convention Middleware] Parsed convention_id:', (req as any).conventionId);
  } else {
    console.log('[Convention Middleware] No convention_id in request');
  }
  next();
}

// API Key authentication middleware
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const validKey = process.env.API_KEY;

  if (!validKey) {
    console.warn('[Auth] API_KEY not configured in environment');
    return res.status(500).json({ error: 'Server authentication not configured' });
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(403).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}

// Admin-only middleware (checks x-admin-id header against DB)
// For simplicity, this checks a header. In production, use JWT tokens.
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const isAdmin = (req as any).isAdmin;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err.message);

  res.status(400).json({
    error: err.message || 'An unexpected error occurred',
  });
}
