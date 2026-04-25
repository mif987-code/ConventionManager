import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  saveFloorPlan, getFloorPlan,
  getTableStatuses, reserveTable, releaseTable
} from '../services/floorPlanService';

const router = Router();

// GET /floor-plan — full plan JSON
router.get('/', requireAuth, async (req, res) => {
  try {
    const plan = await getFloorPlan(req.conventionId);
    if (!plan) return res.status(404).json({ error: 'No floor plan yet' });
    res.json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /floor-plan — save plan (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    await saveFloorPlan(req.conventionId, req.body);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /floor-plan/tables — all tables with reservation status
router.get('/tables', requireAuth, async (req, res) => {
  try {
    const statuses = await getTableStatuses(req.conventionId);
    res.json(statuses);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /floor-plan/tables/:tableId/reserve
router.post('/tables/:tableId/reserve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });
    await reserveTable(
      req.conventionId,
      parseInt(req.params.tableId),
      eventId,
      req.adminId
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /floor-plan/tables/release/:eventId
router.post('/tables/release/:eventId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await releaseTable(parseInt(req.params.eventId), req.conventionId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
