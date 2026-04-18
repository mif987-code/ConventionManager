import { Router, Request, Response, NextFunction } from 'express';
import * as eventService from '../services/eventService';

const router = Router();

// --- Event Types ---

// POST /api/events/types - Create event type
router.post('/types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, format, entry_cost_vouchers, max_players, prize_structure, prize_structure_ties, tournament_structure } = req.body;
    const conventionId = (req as any).conventionId;

    if (!name || !category || entry_cost_vouchers === undefined || !prize_structure) {
      return res.status(400).json({ error: 'name, category, entry_cost_vouchers, and prize_structure are required' });
    }

    const eventType = await eventService.createEventType(
      name, category, format || null, entry_cost_vouchers, max_players || 8, prize_structure, prize_structure_ties, tournament_structure || 'swiss', conventionId
    );
    res.status(201).json({ success: true, event_type: eventType });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/types/:id - Update event type
router.put('/types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const eventType = await eventService.updateEventType(id, req.body);
    res.json({ success: true, event_type: eventType });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/types/:id - Delete event type
router.delete('/types/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await eventService.deleteEventType(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/types/:id/duplicate - Duplicate event type
router.post('/types/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const eventType = await eventService.duplicateEventType(id);
    res.status(201).json({ success: true, event_type: eventType });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/types - List all event types
router.get('/types', async (req: Request, res: Response, next: NextFunction) => {
  const conventionId = (req as any).conventionId;
  try {
    const eventTypes = await eventService.getAllEventTypes(conventionId);
    res.json({ success: true, event_types: eventTypes });
  } catch (err) {
    next(err);
  }
});

// --- Events ---

// POST /api/events - Create a new event
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, event_type_id, preregistration_enabled } = req.body;
    const conventionId = (req as any).conventionId;

    if (!name || !event_type_id) {
      return res.status(400).json({ error: 'name and event_type_id are required' });
    }

    const event = await eventService.createEvent(name, event_type_id, conventionId, preregistration_enabled);
    res.status(201).json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

// GET /api/events - List all events (optional ?status=open)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const conventionId = (req as any).conventionId;
    const events = await eventService.getAllEvents(status, conventionId);
    res.json({ success: true, events });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id - Get event details with participants + rounds + matches
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await eventService.getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const participants = await eventService.getEventParticipants(eventId);
    const rounds = await eventService.getEventRounds(eventId);
    const matches = await eventService.getAllEventMatches(eventId);
    res.json({ success: true, event, participants, rounds, matches });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id/rounds/:round - Get matches for a specific round
router.get('/:id/rounds/:round', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await eventService.getRoundMatches(
      parseInt(req.params.id),
      parseInt(req.params.round)
    );
    res.json({ success: true, matches });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/register - Register user to event
router.post('/:id/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.id);
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const result = await eventService.registerToEvent(user_id, eventId, 'admin');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/register-nfc - Register user to event via NFC scan
router.post('/:id/register-nfc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.id);
    const { nfc_uid } = req.body;

    if (!nfc_uid) return res.status(400).json({ error: 'nfc_uid is required' });

    const userService = await import('../services/userService');
    const user = await userService.getUserByNfcUid(nfc_uid);
    if (!user) return res.status(404).json({ error: 'No user found with this NFC tag' });

    const result = await eventService.registerToEvent(user.id, eventId, 'nfc-scan');
    res.json({ ...result, user: { id: user.id, name: user.name, nfc_uid: user.nfc_uid } });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/start - Start event (open -> ongoing)
router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.startEvent(parseInt(req.params.id));
    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/next-round - Create next Swiss round with pairings
router.post('/:id/next-round', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await eventService.createNextRound(parseInt(req.params.id));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/matches/:matchId/report - Report match result
router.post('/matches/:matchId/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { player1_wins, player2_wins, draws } = req.body;

    if (player1_wins === undefined || player2_wins === undefined) {
      return res.status(400).json({ error: 'player1_wins and player2_wins are required' });
    }

    const result = await eventService.reportMatchResult(
      parseInt(req.params.matchId),
      player1_wins,
      player2_wins,
      draws || 0
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/results - Set participant results (manual override)
router.post('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.id);
    const { results } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required' });
    }

    const updated = [];
    for (const r of results) {
      const result = await eventService.setParticipantResult(eventId, r.user_id, r.position);
      updated.push(result);
    }

    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/finish - Finish event and distribute prizes by W/L record
router.post('/:id/finish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await eventService.finishEvent(parseInt(req.params.id), 'admin');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/cancel - Cancel event and refund participants
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await eventService.cancelEvent(parseInt(req.params.id), 'admin');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
