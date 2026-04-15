import { Router, Request, Response, NextFunction } from 'express';
import * as conventionService from '../services/conventionService';

const router = Router();

// GET /api/conventions - List all conventions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await conventionService.listConventions();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/conventions - Create new convention
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const convention = await conventionService.createConvention(name);
    res.status(201).json({ success: true, convention });
  } catch (err) {
    next(err);
  }
});

// GET /api/conventions/:id - Get convention details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const convention = await conventionService.getConvention(parseInt(req.params.id));
    if (!convention) {
      return res.status(404).json({ error: 'Convention not found' });
    }
    res.json({ success: true, convention });
  } catch (err) {
    next(err);
  }
});

// POST /api/conventions/:id/end - End convention (lock it)
router.post('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const convention = await conventionService.endConvention(parseInt(req.params.id));
    res.json({ success: true, convention });
  } catch (err) {
    next(err);
  }
});

// GET /api/conventions/:id/stats - Get convention statistics
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await conventionService.getConventionStats(parseInt(req.params.id));
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/conventions/:id/export - Export convention data
router.get('/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await conventionService.exportConvention(parseInt(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conventions/:id - Delete convention and all data
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await conventionService.deleteConvention(parseInt(req.params.id));
    res.json({ success: true, message: 'Convention deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
