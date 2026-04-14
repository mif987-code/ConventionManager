"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventService = __importStar(require("../services/eventService"));
const router = (0, express_1.Router)();
// --- Event Types ---
// POST /api/events/types - Create event type
router.post('/types', async (req, res, next) => {
    try {
        const { name, category, format, entry_cost_vouchers, max_players, prize_structure, prize_structure_ties, tournament_structure } = req.body;
        if (!name || !category || entry_cost_vouchers === undefined || !prize_structure) {
            return res.status(400).json({ error: 'name, category, entry_cost_vouchers, and prize_structure are required' });
        }
        const eventType = await eventService.createEventType(name, category, format || null, entry_cost_vouchers, max_players || 8, prize_structure, prize_structure_ties, tournament_structure || 'swiss');
        res.status(201).json({ success: true, event_type: eventType });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/events/types/:id - Update event type
router.put('/types/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const eventType = await eventService.updateEventType(id, req.body);
        res.json({ success: true, event_type: eventType });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/events/types/:id - Delete event type
router.delete('/types/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        await eventService.deleteEventType(id);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/types/:id/duplicate - Duplicate event type
router.post('/types/:id/duplicate', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const eventType = await eventService.duplicateEventType(id);
        res.status(201).json({ success: true, event_type: eventType });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/events/types - List all event types
router.get('/types', async (_req, res, next) => {
    try {
        const types = await eventService.getAllEventTypes();
        res.json({ success: true, event_types: types });
    }
    catch (err) {
        next(err);
    }
});
// --- Events ---
// POST /api/events - Create a new event
router.post('/', async (req, res, next) => {
    try {
        const { name, event_type_id } = req.body;
        if (!name || !event_type_id) {
            return res.status(400).json({ error: 'name and event_type_id are required' });
        }
        const event = await eventService.createEvent(name, event_type_id);
        res.status(201).json({ success: true, event });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/events - List all events (optional ?status=open)
router.get('/', async (req, res, next) => {
    try {
        const status = req.query.status;
        const events = await eventService.getAllEvents(status);
        res.json({ success: true, events });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/events/:id - Get event details with participants + rounds + matches
router.get('/:id', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.id);
        const event = await eventService.getEventById(eventId);
        if (!event)
            return res.status(404).json({ error: 'Event not found' });
        const participants = await eventService.getEventParticipants(eventId);
        const rounds = await eventService.getEventRounds(eventId);
        const matches = await eventService.getAllEventMatches(eventId);
        res.json({ success: true, event, participants, rounds, matches });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/events/:id/rounds/:round - Get matches for a specific round
router.get('/:id/rounds/:round', async (req, res, next) => {
    try {
        const matches = await eventService.getRoundMatches(parseInt(req.params.id), parseInt(req.params.round));
        res.json({ success: true, matches });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/register - Register user to event
router.post('/:id/register', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.id);
        const { user_id } = req.body;
        if (!user_id)
            return res.status(400).json({ error: 'user_id is required' });
        const result = await eventService.registerToEvent(user_id, eventId, 'admin');
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/register-nfc - Register user to event via NFC scan
router.post('/:id/register-nfc', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.id);
        const { nfc_uid } = req.body;
        if (!nfc_uid)
            return res.status(400).json({ error: 'nfc_uid is required' });
        const userService = await Promise.resolve().then(() => __importStar(require('../services/userService')));
        const user = await userService.getUserByNfcUid(nfc_uid);
        if (!user)
            return res.status(404).json({ error: 'No user found with this NFC tag' });
        const result = await eventService.registerToEvent(user.id, eventId, 'nfc-scan');
        res.json({ ...result, user: { id: user.id, name: user.name, nfc_uid: user.nfc_uid } });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/start - Start event (open -> ongoing)
router.post('/:id/start', async (req, res, next) => {
    try {
        const event = await eventService.startEvent(parseInt(req.params.id));
        res.json({ success: true, event });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/next-round - Create next Swiss round with pairings
router.post('/:id/next-round', async (req, res, next) => {
    try {
        const result = await eventService.createNextRound(parseInt(req.params.id));
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/matches/:matchId/report - Report match result
router.post('/matches/:matchId/report', async (req, res, next) => {
    try {
        const { player1_wins, player2_wins, draws } = req.body;
        if (player1_wins === undefined || player2_wins === undefined) {
            return res.status(400).json({ error: 'player1_wins and player2_wins are required' });
        }
        const result = await eventService.reportMatchResult(parseInt(req.params.matchId), player1_wins, player2_wins, draws || 0);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/results - Set participant results (manual override)
router.post('/:id/results', async (req, res, next) => {
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
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/finish - Finish event and distribute prizes by W/L record
router.post('/:id/finish', async (req, res, next) => {
    try {
        const result = await eventService.finishEvent(parseInt(req.params.id), 'admin');
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events/:id/cancel - Cancel event and refund participants
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const result = await eventService.cancelEvent(parseInt(req.params.id), 'admin');
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=events.js.map