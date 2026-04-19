import { Request, Response, NextFunction } from 'express';

// Attaches convention_id from the x-convention-id header to the request object.
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

// Validates the x-api-key header against the API_KEY environment variable.
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const validKey = process.env.API_KEY;

  if (!validKey) {
    res.status(500).json({ error: 'Server authentication not configured' });
    return;
  }

  if (!apiKey || apiKey !== validKey) {
    res.status(403).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }

  next();
}

// Rejects requests from non-admin callers.
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Express error-handling middleware — must have 4 params.
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);
  res.status(400).json({ error: err.message || 'An unexpected error occurred' });
}
