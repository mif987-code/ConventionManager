import { Router, Request, Response, NextFunction } from 'express';
import { getStats } from '../services/statsService';

const router = Router();

// GET /api/stats - Get convention statistics
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getStats(req.conventionId ?? 0);
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
