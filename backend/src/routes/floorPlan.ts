import { Router } from 'express';
// Authentication and permission checks are handled globally in server.ts
import {
  saveFloorPlan, getFloorPlan,
  getTableStatuses, reserveTable, releaseTable
} from '../services/floorPlanService';

const router = Router();

// GET /floor-plan — full plan JSON
router.get('/', async (req, res) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    const plan = await getFloorPlan(conventionId);
    if (!plan) return res.status(404).json({ error: 'No floor plan yet' });
    res.json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /floor-plan — save plan
router.post('/', async (req, res) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    await saveFloorPlan(conventionId, req.body);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /floor-plan/tables — all tables with reservation status
router.get('/tables', async (req, res) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    const statuses = await getTableStatuses(conventionId);
    res.json(statuses);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /floor-plan/tables/:tableId/reserve
router.post('/tables/:tableId/reserve', async (req, res) => {
  const { conventionId, adminId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });
    await reserveTable(conventionId, parseInt(req.params.tableId), eventId, adminId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /floor-plan/tables/release/:eventId
router.post('/tables/release/:eventId', async (req, res) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    await releaseTable(parseInt(req.params.eventId), conventionId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
