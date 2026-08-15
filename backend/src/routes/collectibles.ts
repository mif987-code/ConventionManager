import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../config/db';
import { addTransaction } from '../services/transactionService';

const router = Router();

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/collectibles'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// GET /api/collectibles - List all collectibles for convention
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const result = await pool.query(
      `SELECT * FROM collectibles WHERE convention_id = $1 ORDER BY created_at DESC`,
      [conventionId]
    );
    res.json({ success: true, collectibles: result.rows });
  } catch (err) { next(err); }
});

// POST /api/collectibles - Create a collectible
router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const { name, description, unlock_type, unlock_value, unlock_threshold, bonus_tix } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const imageUrl = req.file ? `/uploads/collectibles/${req.file.filename}` : req.body.image_url || null;
    const result = await pool.query(
      `INSERT INTO collectibles (convention_id, name, description, image_url, unlock_type, unlock_value, unlock_threshold, bonus_tix)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [conventionId, name, description || null, imageUrl, unlock_type || 'event_type_single', unlock_value || null, unlock_threshold ?? 1, bonus_tix ?? 0]
    );
    res.status(201).json({ success: true, collectible: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/collectibles/:id - Update a collectible
router.put('/:id', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, unlock_type, unlock_value, unlock_threshold, bonus_tix } = req.body;
    const imageUrl = req.file ? `/uploads/collectibles/${req.file.filename}` : req.body.image_url || null;
    const result = await pool.query(
      `UPDATE collectibles SET name=$1, description=$2, image_url=$3, unlock_type=$4, unlock_value=$5,
       unlock_threshold=$6, bonus_tix=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name, description || null, imageUrl, unlock_type, unlock_value || null, unlock_threshold ?? 1, bonus_tix ?? 0, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, collectible: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/collectibles/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`DELETE FROM collectibles WHERE id=$1`, [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/collectibles/sets - List collection sets
router.get('/sets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const sets = await pool.query(
      `SELECT cs.*, COALESCE(json_agg(c.*) FILTER (WHERE c.id IS NOT NULL), '[]') AS collectibles
       FROM collection_sets cs
       LEFT JOIN collection_set_items csi ON csi.set_id = cs.id
       LEFT JOIN collectibles c ON c.id = csi.collectible_id
       WHERE cs.convention_id = $1
       GROUP BY cs.id ORDER BY cs.created_at DESC`,
      [conventionId]
    );
    res.json({ success: true, sets: sets.rows });
  } catch (err) { next(err); }
});

// POST /api/collectibles/sets - Create a collection set
router.post('/sets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const { name, description, bonus_tix, collectible_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const setRes = await client.query(
        `INSERT INTO collection_sets (convention_id, name, description, bonus_tix) VALUES ($1,$2,$3,$4) RETURNING *`,
        [conventionId, name, description || null, bonus_tix ?? 0]
      );
      const setId = setRes.rows[0].id;
      if (Array.isArray(collectible_ids)) {
        for (const cid of collectible_ids) {
          await client.query(`INSERT INTO collection_set_items (set_id, collectible_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [setId, cid]);
        }
      }
      await client.query('COMMIT');
      res.status(201).json({ success: true, set: setRes.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

// PUT /api/collectibles/sets/:id - Update a collection set
router.put('/sets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, bonus_tix, collectible_ids } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const setRes = await client.query(
        `UPDATE collection_sets SET name=$1, description=$2, bonus_tix=$3 WHERE id=$4 RETURNING *`,
        [name, description || null, bonus_tix ?? 0, id]
      );
      if (!setRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
      await client.query(`DELETE FROM collection_set_items WHERE set_id=$1`, [id]);
      if (Array.isArray(collectible_ids)) {
        for (const cid of collectible_ids) {
          await client.query(`INSERT INTO collection_set_items (set_id, collectible_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, cid]);
        }
      }
      await client.query('COMMIT');
      res.json({ success: true, set: setRes.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

// DELETE /api/collectibles/sets/:id
router.delete('/sets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`DELETE FROM collection_sets WHERE id=$1`, [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/collectibles/player/:userId - Get a player's earned collectibles
router.get('/player/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const userId = parseInt(req.params.userId);
    const result = await pool.query(
      `SELECT c.*, pc.earned_at FROM collectibles c
       JOIN player_collectibles pc ON pc.collectible_id = c.id
       WHERE pc.user_id=$1 AND pc.convention_id=$2`,
      [userId, conventionId]
    );
    res.json({ success: true, collectibles: result.rows });
  } catch (err) { next(err); }
});

// POST /api/collectibles/award - Manually award a collectible to a player
router.post('/award', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const { user_id, collectible_id } = req.body;
    if (!user_id || !collectible_id) return res.status(400).json({ error: 'user_id and collectible_id are required' });

    const collectible = await pool.query(`SELECT * FROM collectibles WHERE id=$1`, [collectible_id]);
    if (!collectible.rows.length) return res.status(404).json({ error: 'Collectible not found' });
    const c = collectible.rows[0];

    const inserted = await pool.query(
      `INSERT INTO player_collectibles (user_id, collectible_id, convention_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
      [user_id, collectible_id, conventionId]
    );

    if (inserted.rows.length && c.bonus_tix > 0) {
      await addTransaction({ userId: user_id, type: 'tix', amount: c.bonus_tix, reason: 'prize', eventId: null, createdBy: 'admin', conventionId });
    }

    res.json({ success: true, already_owned: inserted.rows.length === 0 });
  } catch (err) { next(err); }
});

export default router;
