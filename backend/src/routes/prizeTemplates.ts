import { Router, Request, Response, NextFunction } from 'express';
import * as prizeTemplateService from '../services/prizeTemplateService';

const router = Router();

// GET /api/prize-templates - List all templates (optionally filter by ?rounds=N)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rounds = req.query.rounds ? parseInt(req.query.rounds as string) : undefined;
    const templates = rounds
      ? await prizeTemplateService.getPrizeTemplatesByRounds(rounds)
      : await prizeTemplateService.getAllPrizeTemplates();
    res.json({ success: true, templates });
  } catch (err) {
    next(err);
  }
});

// GET /api/prize-templates/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prizeTemplateService.getPrizeTemplateById(parseInt(req.params.id));
    if (!template) return res.status(404).json({ error: 'Prize template not found' });
    res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

// POST /api/prize-templates - Create
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, rounds, prize_structure, prize_structure_ties } = req.body;
    if (!name || !rounds || !prize_structure || !prize_structure_ties) {
      return res.status(400).json({ error: 'name, rounds, prize_structure, and prize_structure_ties are required' });
    }
    const template = await prizeTemplateService.createPrizeTemplate(name, rounds, prize_structure, prize_structure_ties);
    res.status(201).json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

// PUT /api/prize-templates/:id - Update
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prizeTemplateService.updatePrizeTemplate(parseInt(req.params.id), req.body);
    res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/prize-templates/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prizeTemplateService.deletePrizeTemplate(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
