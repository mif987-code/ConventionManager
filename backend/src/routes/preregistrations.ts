import { Router, Request, Response, NextFunction } from 'express';
import * as preregistrationService from '../services/preregistrationService';

const router = Router();

// GET /api/preregistrations - List all pre-registered users for the current convention
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conventionId = req.conventionId;
    if (!conventionId) return res.status(400).json({ error: 'x-convention-id header is required' });

    const users = await preregistrationService.listPreregisteredUsers(conventionId);
    res.json({ success: true, users });
  } catch (err) { next(err); }
});

// GET /api/preregistrations/stats - Aggregate stats (per-event, per-package counts)
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conventionId = req.conventionId;
    if (!conventionId) return res.status(400).json({ error: 'x-convention-id header is required' });

    const stats = await preregistrationService.getPreregistrationStats(conventionId);
    res.json({ success: true, stats });
  } catch (err) { next(err); }
});

export default router;
