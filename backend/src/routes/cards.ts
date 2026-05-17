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
    if (q.length > 200) {
      return res.status(400).json({ error: 'Query too long (max 200 characters)' });
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

// Prints search URI cache for performance
const printsSearchUriCache = new Map<string, string>();

// GET /api/cards/sets-by-card - Get all sets that contain a specific card
router.get('/sets-by-card', async (req: Request, res: Response) => {
  try {
    const { name } = req.query;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing card name' });
    }
    if (name.length > 200) {
      return res.status(400).json({ error: 'Card name too long (max 200 characters)' });
    }
    
    const EXCLUDE_LAYOUTS = new Set(['token', 'art_series', 'emblem']);
    const EXCLUDE_SET_TYPES = new Set(['memorabilia', 'minigame']);
    const setsMap = new Map();
    
    // Step 1: Get Oracle ID and prints_search_uri from card name (with caching)
    let printsSearchUri: string | null = null;
    if (printsSearchUriCache.has(name)) {
      const cachedData = printsSearchUriCache.get(name)!;
      printsSearchUri = cachedData;
      console.log('[Cards API] Using cached prints_search_uri for:', name);
    } else {
      try {
        const namedRes = await axios.get(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
          {
            headers: {
              'User-Agent': 'ConventionManager/1.0',
              'Accept': 'application/json',
            },
          }
        );
        printsSearchUri = namedRes.data.prints_search_uri;
        if (printsSearchUri) {
          printsSearchUriCache.set(name, printsSearchUri);
          console.log('[Cards API] Fetched and cached prints_search_uri for:', name);
        }
      } catch (err) {
        console.log('[Cards API] Failed to fetch card data for:', name, 'will use name search only');
      }
    }
    
    // Step 2: Search using prints_search_uri if available
    if (printsSearchUri) {
      try {
        console.log('[Cards API] Using prints_search_uri:', printsSearchUri);
        let next = printsSearchUri;
        
        while (next) {
          const response = await axios.get(next, {
            headers: {
              'User-Agent': 'ConventionManager/1.0',
              'Accept': 'application/json',
            },
          });
          const data = response.data;
          console.log('[Cards API] Prints search page - cards:', data.data?.length || 0, 'has_more:', data.has_more);
          
          if (data.data) {
            for (const card of data.data) {
              // Filter out digital-only cards
              if (!card.games || !card.games.includes('paper')) continue;
              
              // Filter out unwanted layouts and set types
              if (EXCLUDE_LAYOUTS.has(card.layout)) continue;
              if (EXCLUDE_SET_TYPES.has(card.set_type)) continue;
              
              if (!setsMap.has(card.set)) {
                setsMap.set(card.set, {
                  code: card.set,
                  name: card.set_name,
                  released_at: card.released_at,
                });
              }
            }
          }
          
          next = data.has_more ? data.next_page : null;
        }
      } catch (err) {
        console.log('[Cards API] Prints search failed, falling back to name search');
      }
    }
    
    // Step 3: Fallback/Supplement with name search
    console.log('[Cards API] Supplementing with name search');
    const nameUrl = `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"+game:paper`;
    let next = nameUrl;
    
    while (next) {
      const response = await axios.get(next, {
        headers: {
          'User-Agent': 'ConventionManager/1.0',
          'Accept': 'application/json',
        },
      });
      const data = response.data;
      
      if (data.data) {
        for (const card of data.data) {
          if (EXCLUDE_LAYOUTS.has(card.layout)) continue;
          if (EXCLUDE_SET_TYPES.has(card.set_type)) continue;
          
          if (!setsMap.has(card.set)) {
            setsMap.set(card.set, {
              code: card.set,
              name: card.set_name,
              released_at: card.released_at,
            });
          }
        }
      }
      
      next = data.has_more ? data.next_page : null;
    }
    
    const result = Array.from(setsMap.values()).sort((a, b) =>
      (b.released_at || '').localeCompare(a.released_at || '')
    );
    
    console.log('[Cards API] Sets returned for card:', name, 'count:', result.length);
    res.json(result);
  } catch (err: any) {
    console.error('[Cards API] Error fetching card sets:', err.message);
    console.error('[Cards API] Full error:', err);
    res.status(500).json({ error: 'Failed to fetch sets' });
  }
});

export default router;
