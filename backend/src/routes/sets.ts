import { Router, Request, Response } from 'express';
import { getAllSets, searchSets } from '../services/setService';

const router = Router();

// GET /api/sets - Get all sets (with optional search)
router.get('/', (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (q && typeof q === 'string') {
    const results = searchSets(q);
    res.json({ sets: results });
  } else {
    const allSets = getAllSets();
    res.json({ sets: allSets });
  }
});

export default router;
