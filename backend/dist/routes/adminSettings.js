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
const adminSettingsService = __importStar(require("../services/adminSettingsService"));
const router = (0, express_1.Router)();
// GET /api/admin/settings - Get all settings (admin only)
router.get('/', async (req, res, next) => {
    try {
        const settings = await adminSettingsService.getAllSettings();
        res.json({ success: true, settings });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/settings/:key - Get a specific setting (admin only)
router.get('/:key', async (req, res, next) => {
    try {
        const value = await adminSettingsService.getSetting(req.params.key);
        if (value === null) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ success: true, key: req.params.key, value });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/settings/:key - Update a setting (admin only)
router.put('/:key', async (req, res, next) => {
    try {
        const { value } = req.body;
        if (value === undefined || value === null || value === '') {
            return res.status(400).json({ error: 'value is required' });
        }
        await adminSettingsService.setSetting(req.params.key, value, undefined);
        res.json({ success: true, message: 'Setting updated' });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/settings/qr-secret-key - Update QR secret key
router.put('/qr-secret-key', async (req, res, next) => {
    try {
        const { value } = req.body;
        if (!value || typeof value !== 'string' || value.length < 16) {
            return res.status(400).json({ error: 'value must be a string of at least 16 characters' });
        }
        await adminSettingsService.setQRSecretKey(value, undefined);
        res.json({ success: true, message: 'QR secret key updated' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=adminSettings.js.map