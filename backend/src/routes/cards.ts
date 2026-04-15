import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// GET /api/cards/search - Search cards by name and set
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, set } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`;
    if (set && typeof set === 'string') {
      url += ` set:${encodeURIComponent(set)}`;
    }

    const response = await axios.get(url);
    
    if (response.data && response.data.data) {
      const cards = response.data.data.map((card: any) => ({
        name: card.name,
        set_name: card.set_name,
        set_code: card.set,
        collector_number: card.collector_number,
        foil: card.foil,
        prices: card.prices,
        image_uris: card.image_uris,
        card_faces: card.card_faces,
      }));
      res.json({ cards });
    } else {
      res.json({ cards: [] });
    }
  } catch (err: any) {
    console.error('[Cards API] Error:', err.message);
    res.json({ cards: [] });
  }
});

// GET /api/cards/set/:setCode - Get all cards in a set (for CN autocomplete)
router.get('/set/:setCode', async (req: Request, res: Response) => {
  try {
    const { setCode } = req.params;
    
    const url = `https://api.scryfall.com/cards/search?q=set:${encodeURIComponent(setCode)}`;
    const response = await axios.get(url);
    
    if (response.data && response.data.data) {
      const cards = response.data.data.map((card: any) => ({
        name: card.name,
        collector_number: card.collector_number,
        foil: card.foil,
      })).sort((a: any, b: any) => a.collector_number.localeCompare(b.collector_number, undefined, { numeric: true }));
      
      res.json({ cards });
    } else {
      res.json({ cards: [] });
    }
  } catch (err: any) {
    console.error('[Cards API] Error fetching set cards:', err.message);
    res.json({ cards: [] });
  }
});

// GET /api/cards/:cardName/sets - Get all sets that contain a specific card
router.get('/:cardName/sets', async (req: Request, res: Response) => {
  try {
    const { cardName } = req.params;
    
    const EXCLUDE_LAYOUTS = new Set(['token', 'art_series', 'emblem']);
    const EXCLUDE_SET_TYPES = new Set(['memorabilia', 'minigame']);
    
    const url = `https://api.scryfall.com/cards/search?q=!${encodeURIComponent(cardName)}+game:paper`;
    let next = url;
    const setsMap = new Map();
    
    while (next) {
      const response = await axios.get(next);
      const data = response.data;
      
      if (data.data) {
        for (const card of data.data) {
          if (EXCLUDE_LAYOUTS.has(card.layout)) continue;
          if (EXCLUDE_SET_TYPES.has(card.set_type)) continue;
          
          if (!setsMap.has(card.set)) {
            setsMap.set(card.set, {
              code: card.set,
              name: card.set_name,
              set_type: card.set_type,
              card_count: 0,
            });
          }
        }
      }
      
      next = data.has_more ? data.next_page : null;
    }
    
    const sets = Array.from(setsMap.values());
    res.json({ sets });
  } catch (err: any) {
    console.error('[Cards API] Error fetching card sets:', err.message);
    res.json({ sets: [] });
  }
});

export default router;
