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
const router = (0, express_1.Router)();
// POST /api/users/register - Register a new user (NFC optional)
router.post('/register', async (req, res, next) => {
    try {
        const { name, nfc_uid, email, is_admin, attendance_dates } = req.body;
        const conventionId = req.conventionId;
        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }
        if (nfc_uid) {
            const existing = await userService.getUserByNfcUid(nfc_uid, conventionId);
            if (existing) {
                return res.status(409).json({ error: 'NFC tag already registered' });
            }
        }
        // Convert attendance dates strings to Date objects
        const dates = attendance_dates ? attendance_dates.map((d) => new Date(d)) : undefined;
        const user = await userService.createUser(name, nfc_uid, email, is_admin, conventionId, dates);
        res.status(201).json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users - List all users
router.get('/', async (req, res, next) => {
    try {
        const conventionId = req.conventionId;
        const users = await userService.getAllUsers(conventionId);
        res.json({ success: true, users });
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
        const users = await userService.searchUsers(q);
        res.json({ success: true, users });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/:id - Get user with balances
router.get('/:id', async (req, res, next) => {
    try {
        const user = await userService.getUserWithBalances(parseInt(req.params.id));
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
        const user = await userService.regenerateQRCode(parseInt(req.params.id));
        res.json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map