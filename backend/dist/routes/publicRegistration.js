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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../config/db");
const paymentService = __importStar(require("../services/paymentService"));
const googleSheetsService_1 = require("../services/googleSheetsService");
const router = (0, express_1.Router)();
// Cap registrations per IP to blunt scripted signup floods.
const registrationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registrations. Please try again later.' },
});
// Verifies a Google reCAPTCHA v2 token server-side. If RECAPTCHA_SECRET_KEY
// isn't set, verification is skipped entirely (useful for local dev before
// keys are configured) so this never blocks the app from running.
async function verifyRecaptcha(token) {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret)
        return true; // not configured — skip
    if (!token)
        return false;
    try {
        const params = new URLSearchParams({ secret, response: token });
        const { data } = await axios_1.default.post('https://www.google.com/recaptcha/api/siteverify', params);
        return Boolean(data.success);
    }
    catch (err) {
        console.error('[Recaptcha] Verification request failed:', err.message);
        return false;
    }
}
// Letters (any language), spaces, apostrophes, hyphens, and periods only — no
// digits or symbols. Blocks junk/script-injection-style input in name fields
// (note: this is a data-quality guard, not a SQL-injection fix — all queries
// here already use parameterized values, so injection was never possible).
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]{0,49}$/u;
// POST /public/preregister - Public pre-registration (no API key needed)
router.post('/preregister', registrationLimiter, async (req, res, next) => {
    try {
        const { name, last_name, email, password, age, dob, attendance_dates, package_id, packages: packagesInput, event_prereg_ids, recaptcha_token } = req.body;
        if (!name || !last_name || !email || !password) {
            return res.status(400).json({ error: 'name, last_name, email, and password are required' });
        }
        if (typeof name !== 'string' || !NAME_PATTERN.test(name.trim())) {
            return res.status(400).json({ error: 'First name can only contain letters, spaces, hyphens, and apostrophes' });
        }
        if (typeof last_name !== 'string' || !NAME_PATTERN.test(last_name.trim())) {
            return res.status(400).json({ error: 'Last name can only contain letters, spaces, hyphens, and apostrophes' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const recaptchaValid = await verifyRecaptcha(recaptcha_token);
        if (!recaptchaValid) {
            return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
        }
        // Normalize package selection: support both the legacy single `package_id`
        // and the new `packages: [{ package_id, quantity }]` multi-select format.
        const selectedPackages = Array.isArray(packagesInput) && packagesInput.length > 0
            ? packagesInput
                .filter((p) => p && p.package_id)
                .map((p) => ({ package_id: parseInt(p.package_id), quantity: Math.max(1, parseInt(p.quantity) || 1) }))
            : (package_id ? [{ package_id: parseInt(package_id), quantity: 1 }] : []);
        // Check if email already registered
        const existing = await db_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'This email is already registered' });
        }
        // Get active convention, fall back to most recent convention
        let convRes = await db_1.pool.query(`SELECT id FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);
        let conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;
        // If no active convention, try to get the most recent convention
        if (!conventionId) {
            convRes = await db_1.pool.query(`SELECT id FROM conventions ORDER BY created_at DESC LIMIT 1`);
            conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;
        }
        if (!conventionId) {
            return res.status(400).json({ error: 'No convention found. Please create a convention in the admin panel first.' });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const result = await db_1.pool.query(`INSERT INTO users (name, last_name, email, age, dob, is_preregistered, convention_id, password_hash)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)
       RETURNING id, name, last_name, email, age, dob, is_preregistered, created_at`, [name, last_name, email, age || null, dob || null, conventionId, passwordHash]);
        // Insert attendance dates if provided
        const userId = result.rows[0].id;
        if (attendance_dates && Array.isArray(attendance_dates) && attendance_dates.length > 0) {
            for (const dateStr of attendance_dates) {
                await db_1.pool.query(`INSERT INTO user_attendance (user_id, convention_id, attendance_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, convention_id, attendance_date) DO NOTHING`, [userId, conventionId, dateStr]);
            }
        }
        // Insert package selections if provided (supports multiple packages, each with a quantity multiplier)
        let totalPackageCost = 0;
        const packageBreakdown = [];
        for (const selection of selectedPackages) {
            const { package_id: pkgId, quantity } = selection;
            await db_1.pool.query(`INSERT INTO user_packages (user_id, convention_id, package_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, convention_id, package_id) DO UPDATE SET quantity = $4`, [userId, conventionId, pkgId, quantity]);
            // Get package details to check if payment is required
            const packageRes = await db_1.pool.query(`SELECT id, name, regular_voucher_amount, prereg_cost, cost, package_type FROM packages WHERE id = $1`, [pkgId]);
            if (packageRes.rows.length > 0) {
                const pkg = packageRes.rows[0];
                const unitCost = pkg.prereg_cost || pkg.cost;
                const packageCost = unitCost * quantity;
                totalPackageCost += packageCost;
                packageBreakdown.push({ package_id: pkg.id, name: pkg.name, quantity, unit_cost: unitCost, total_cost: packageCost });
                // Only award vouchers if package has no cost (free package)
                if (packageCost === 0 && pkg.regular_voucher_amount > 0) {
                    await db_1.pool.query(`INSERT INTO voucher_transactions (user_id, amount, description)
             VALUES ($1, $2, $3)`, [userId, pkg.regular_voucher_amount * quantity, `Package registration bonus (${pkg.name} x${quantity})`]);
                }
                // Get special vouchers for this package
                const specialVouchersRes = await db_1.pool.query(`SELECT sv.id, sv.amount, sv.name
           FROM package_special_vouchers psv
           JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
           WHERE psv.package_id = $1`, [pkgId]);
                // Award special vouchers only if package is free (one award record per unit purchased)
                if (packageCost === 0) {
                    for (const sv of specialVouchersRes.rows) {
                        for (let i = 0; i < quantity; i++) {
                            await db_1.pool.query(`INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
                 VALUES ($1, $2, NULL, 'package_registration')`, [userId, sv.id]);
                        }
                    }
                }
            }
        }
        // Insert event pre-registrations if provided
        if (event_prereg_ids && Array.isArray(event_prereg_ids) && event_prereg_ids.length > 0) {
            const fullName = `${name} ${last_name}`.trim();
            for (const eventId of event_prereg_ids) {
                await db_1.pool.query(`INSERT INTO event_participants (user_id, event_id, convention_id, preregistered)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, event_id) DO UPDATE SET preregistered = true`, [userId, eventId, conventionId]);
                const eventRes = await db_1.pool.query(`SELECT name FROM events WHERE id = $1`, [eventId]);
                if (eventRes.rows.length > 0) {
                    await (0, googleSheetsService_1.syncPreregistrationToSheet)(eventRes.rows[0].name, fullName, email);
                }
            }
        }
        res.status(201).json({
            success: true,
            user: result.rows[0],
            package_total_cost: totalPackageCost,
            package_breakdown: packageBreakdown,
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /public/payment - Create a payment for a registered user (no API key needed)
// This is used by the registration form to redirect the player to Onvo/TiloPay.
// Payment vouchers are awarded by the webhook when status becomes 'paid'.
router.post('/payment', async (req, res, next) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }
        // Re-calculate package total from the database so the amount can't be faked
        const pkgRes = await db_1.pool.query(`SELECT up.package_id, up.quantity, p.prereg_cost, p.cost, p.regular_voucher_amount
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = $1`, [user_id]);
        if (pkgRes.rows.length === 0) {
            return res.status(400).json({ error: 'No packages selected for this user' });
        }
        const total = pkgRes.rows.reduce((sum, pkg) => {
            const unitCost = pkg.prereg_cost || pkg.cost;
            return sum + (unitCost * (pkg.quantity || 1));
        }, 0);
        if (total <= 0) {
            return res.status(400).json({ error: 'Package total is 0; no payment needed' });
        }
        const payment = await paymentService.createPayment(total);
        await paymentService.storePayment(payment, parseInt(user_id, 10));
        res.json({
            success: true,
            paymentId: payment.id,
            paymentUrl: payment.paymentUrl,
            amount: payment.amount,
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /public/payment/:id/status - Public payment status/receipt lookup
router.get('/payment/:id/status', async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id)
            return res.status(400).json({ error: 'Payment ID required' });
        const result = await db_1.pool.query(`SELECT id, user_id, amount, status, created_at, updated_at FROM payments WHERE id = $1`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Payment not found' });
        res.json({ success: true, payment: result.rows[0] });
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
// GET /public/convention - Get active convention info
router.get('/convention', async (req, res, next) => {
    try {
        console.log('Fetching convention info...');
        let convRes = await db_1.pool.query(`SELECT id, name, start_date, end_date, scan_mode FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);
        // If no active convention, try to get the most recent convention
        if (convRes.rows.length === 0) {
            console.log('No active convention, fetching most recent...');
            convRes = await db_1.pool.query(`SELECT id, name, start_date, end_date, scan_mode FROM conventions ORDER BY created_at DESC LIMIT 1`);
        }
        if (convRes.rows.length === 0) {
            return res.status(404).json({ error: 'No convention found. Please create a convention in the admin panel first.' });
        }
        const convention = convRes.rows[0];
        console.log('Convention found:', convention.id, convention.name);
        // Calculate available dates
        const dates = [];
        if (convention.start_date && convention.end_date) {
            const current = new Date(convention.start_date);
            const end = new Date(convention.end_date);
            while (current <= end) {
                dates.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }
        }
        console.log('Available dates:', dates.length);
        // Get packages for this convention
        console.log('Fetching packages for convention:', convention.id);
        const packagesRes = await db_1.pool.query(`SELECT * FROM packages WHERE convention_id = $1 AND is_active = TRUE ORDER BY days ASC, cost ASC`, [convention.id]);
        console.log('Packages found:', packagesRes.rows.length);
        // Get events with preregistration enabled (handle if column doesn't exist)
        console.log('Fetching events for convention:', convention.id);
        let eventsRes;
        try {
            eventsRes = await db_1.pool.query(`SELECT e.id, e.name, e.schedule_day, e.start_time, e.end_time, e.track,
                et.max_players, et.entry_cost_colones, et.category, et.format
         FROM events e
         JOIN event_types et ON e.event_type_id = et.id
         WHERE e.convention_id = $1 AND e.preregistration_enabled = TRUE
         ORDER BY e.schedule_day ASC NULLS LAST, e.start_time ASC NULLS LAST, e.created_at ASC`, [convention.id]);
            console.log('Events found:', eventsRes.rows.length);
        }
        catch (err) {
            // If preregistration_enabled column doesn't exist, return empty events
            console.error('Error querying events (preregistration_enabled column may not exist):', err);
            eventsRes = { rows: [] };
        }
        res.json({ convention, available_dates: dates, packages: packagesRes.rows, events: eventsRes.rows });
    }
    catch (err) {
        console.error('Error in /public/convention:', err);
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=publicRegistration.js.map