"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const router = (0, express_1.Router)();
// Simple in-memory rate limiter per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10; // max 10 registrations per window per IP
function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return next();
    }
    if (entry.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many registrations. Please try again later.' });
    }
    entry.count++;
    return next();
}
// POST /public/preregister - Public pre-registration (no API key needed)
router.post('/preregister', rateLimit, async (req, res, next) => {
    try {
        const { name, last_name, email, age, dob } = req.body;
        if (!name || !last_name || !email) {
            return res.status(400).json({ error: 'name, last_name, and email are required' });
        }
        // Check if email already registered
        const existing = await db_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'This email is already registered' });
        }
        const result = await db_1.pool.query(`INSERT INTO users (name, last_name, email, age, dob, is_preregistered)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, last_name, email, age, dob, is_preregistered, created_at`, [name, last_name, email, age || null, dob || null]);
        res.status(201).json({ success: true, user: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /public/preregister/check?email=... - Check if email already registered
router.get('/preregister/check', async (req, res, next) => {
    try {
        const email = req.query.email;
        if (!email)
            return res.status(400).json({ error: 'email query param required' });
        const existing = await db_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
        res.json({ registered: existing.rows.length > 0 });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=publicRegistration.js.map