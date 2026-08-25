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
const userService = __importStar(require("../services/userService"));
const paymentService = __importStar(require("../services/paymentService"));
const qrTokenService_1 = require("../services/qrTokenService");
const db_1 = require("../config/db");
const router = (0, express_1.Router)();
// POST /api/users/register - Register a new user (NFC optional)
router.post('/register', async (req, res, next) => {
    try {
        const { name, nfc_uid, email, is_admin, attendance_dates, package_id } = req.body;
        const { conventionId } = req;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'name is required' });
        }
        if (email !== undefined && email !== null && email !== '') {
            if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }
        if (nfc_uid) {
            const existing = await userService.getUserByNfcUid(nfc_uid, conventionId);
            if (existing) {
                return res.status(409).json({ error: 'NFC tag already registered' });
            }
        }
        const dates = attendance_dates
            ? attendance_dates.map((d) => {
                if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(d)) {
                    throw Object.assign(new Error(`Invalid date format: ${d}`), { status: 400 });
                }
                const date = new Date(d);
                if (isNaN(date.getTime()))
                    throw Object.assign(new Error(`Invalid date: ${d}`), { status: 400 });
                return date;
            })
            : undefined;
        const user = await userService.createUser(name, nfc_uid, email, is_admin, conventionId, dates);
        // Insert package selection if provided
        if (package_id && conventionId) {
            await db_1.pool.query(`INSERT INTO user_packages (user_id, convention_id, package_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, convention_id) DO UPDATE SET package_id = $3`, [user.id, conventionId, package_id]);
            // Get package details to check if payment is required
            const packageRes = await db_1.pool.query(`SELECT regular_voucher_amount, prereg_cost, cost FROM packages WHERE id = $1`, [package_id]);
            if (packageRes.rows.length > 0) {
                const pkg = packageRes.rows[0];
                const packageCost = pkg.prereg_cost || pkg.cost;
                // Only award vouchers if package has no cost (free package)
                if (packageCost === 0 && pkg.regular_voucher_amount > 0) {
                    await db_1.pool.query(`INSERT INTO voucher_transactions (user_id, amount, description)
             VALUES ($1, $2, $3)`, [user.id, pkg.regular_voucher_amount, `Package registration bonus`]);
                }
                // Get special vouchers for this package
                const specialVouchersRes = await db_1.pool.query(`SELECT sv.id, sv.amount, sv.name
           FROM package_special_vouchers psv
           JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
           WHERE psv.package_id = $1`, [package_id]);
                // Award special vouchers only if package is free
                if (packageCost === 0) {
                    for (const sv of specialVouchersRes.rows) {
                        await db_1.pool.query(`INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
               VALUES ($1, $2, NULL, 'package_registration')`, [user.id, sv.id]);
                    }
                }
            }
        }
        res.status(201).json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users - List all users
router.get('/', async (req, res, next) => {
    try {
        const { conventionId } = req;
        const users = await userService.getAllUsers(conventionId);
        res.json({ success: true, users });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/:id/payments - Get payments for a user
router.get('/:id/payments', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId))
            return res.status(400).json({ error: 'Invalid user ID' });
        const payments = await paymentService.getUserPayments(userId);
        res.json({ success: true, payments });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/search?q=... - Search users by name or NFC UID
router.get('/search', async (req, res, next) => {
    try {
        const q = req.query.q;
        if (!q)
            return res.status(400).json({ error: 'Query parameter q is required' });
        if (q.length > 100)
            return res.status(400).json({ error: 'Query too long (max 100 characters)' });
        const users = await userService.searchUsers(q, req.conventionId);
        res.json({ success: true, users });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/:id - Get user with balances
router.get('/:id', async (req, res, next) => {
    try {
        const user = await userService.getUserWithBalances(parseInt(req.params.id), req.conventionId);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/users/:id - Update user
router.put('/:id', async (req, res, next) => {
    try {
        const { name, nfc_uid, email, days_playing, is_admin } = req.body;
        const user = await userService.updateUser(parseInt(req.params.id), {
            name, nfc_uid, email, days_playing, is_admin,
        });
        if (!user)
            return res.status(404).json({ error: 'User not found or no changes' });
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/users/:id/regenerate-qr - Regenerate QR code for user
router.post('/:id/regenerate-qr', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { adminId } = req;
        const user = await userService.regenerateQRCode(userId);
        // Log the action
        await db_1.pool.query(`INSERT INTO admin_logs (action, details, user_id, admin_id) VALUES ($1, $2, $3, $4)`, ['qr_regenerated', `Admin regenerated QR code for user ${userId}`, userId, adminId]);
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/:id/qr-token - Generate and return QR token for user
router.get('/:id/qr-token', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const token = await (0, qrTokenService_1.generateQRToken)(userId, 24); // 24 hour expiry
        res.json({ success: true, token });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/users/:id/activate - Admin activates a user by scanning their QR
router.post('/:id/activate', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId))
            return res.status(400).json({ error: 'Invalid user ID' });
        const user = await userService.activateUser(userId, req.adminId ?? 0);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        await db_1.pool.query(`INSERT INTO admin_logs (action, details, user_id, admin_id) VALUES ($1, $2, $3, $4)`, ['user_activated', `Admin activated user ${userId}`, userId, req.adminId ?? null]);
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/users/:id/deactivate - Admin deactivates a user
router.post('/:id/deactivate', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId))
            return res.status(400).json({ error: 'Invalid user ID' });
        const user = await userService.deactivateUser(userId);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        await db_1.pool.query(`INSERT INTO admin_logs (action, details, user_id, admin_id) VALUES ($1, $2, $3, $4)`, ['user_deactivated', `Admin deactivated user ${userId}`, userId, req.adminId ?? null]);
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/users/:id - Permanently delete a user
router.delete('/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId))
            return res.status(400).json({ error: 'Invalid user ID' });
        const deleted = await userService.deleteUser(userId);
        if (!deleted)
            return res.status(404).json({ error: 'User not found' });
        await db_1.pool.query(`INSERT INTO admin_logs (action, details, user_id, admin_id) VALUES ($1, $2, $3, $4)`, ['user_deleted', `Admin deleted user ${userId}`, null, req.adminId ?? null]);
        res.json({ success: true, message: 'User deleted' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map