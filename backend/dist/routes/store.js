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
const storeService = __importStar(require("../services/storeService"));
const bulkImportService = __importStar(require("../services/bulkImportService"));
const db_1 = require("../config/db");
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
// --- Items ---
// GET /api/store/items - List items (admin: all, public: active only via ?active=true)
router.get('/items', async (req, res, next) => {
    try {
        const activeOnly = req.query.active === 'true';
        const conventionId = req.conventionId;
        const items = await storeService.getAllItems(activeOnly, conventionId);
        res.json({ success: true, items });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/store/items/:id - Get single item
router.get('/items/:id', async (req, res, next) => {
    try {
        const item = await storeService.getItemById(parseInt(req.params.id));
        if (!item)
            return res.status(404).json({ error: 'Item not found' });
        res.json({ success: true, item });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/store/items - Create item (admin)
router.post('/items', async (req, res, next) => {
    try {
        const { name, description, price_tix, stock, image_url, set_name, card_number, language, condition, foil, cost } = req.body;
        const conventionId = req.conventionId;
        if (!name || price_tix === undefined) {
            return res.status(400).json({ error: 'name and price_tix are required' });
        }
        const item = await storeService.createItem(name, description || null, price_tix, stock || 0, image_url || null, { set_name, card_number, language, condition, foil, cost }, conventionId);
        res.status(201).json({ success: true, item });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/store/items/:id - Update item (admin)
router.put('/items/:id', async (req, res, next) => {
    try {
        const item = await storeService.updateItem(parseInt(req.params.id), req.body);
        res.json({ success: true, item });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/store/items/:id - Delete item (admin)
router.delete('/items/:id', async (req, res, next) => {
    try {
        await storeService.deleteItem(parseInt(req.params.id));
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/store/bulk-import - Bulk import items from Excel/CSV (admin)
router.post('/bulk-import', upload.single('file'), async (req, res, next) => {
    try {
        // If items are sent as JSON (from verification UI), import directly
        if (req.body.items && Array.isArray(req.body.items)) {
            const { items, validate_scryfall } = req.body;
            const validateWithScryfall = validate_scryfall === 'true' || validate_scryfall === true;
            const conventionId = req.conventionId;
            console.log('[Store Route] Bulk import from JSON - items:', items.length, 'conventionId:', conventionId);
            const result = await bulkImportService.bulkImportItems(items, validateWithScryfall, conventionId);
            res.json(result);
            return;
        }
        // Otherwise, parse from file upload
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { validate_scryfall, dry_run } = req.body;
        const validateWithScryfall = validate_scryfall === 'true' || validate_scryfall === true;
        const dryRun = dry_run === 'true' || dry_run === true;
        const conventionId = req.conventionId;
        console.log('[Store Route] Bulk import - conventionId from request:', conventionId);
        const items = await bulkImportService.parseImportFile(req.file.buffer, req.file.originalname);
        if (dryRun) {
            // Just parse and validate, don't import
            const result = await bulkImportService.validateItems(items, validateWithScryfall);
            res.json(result);
        }
        else {
            // Actually import
            const result = await bulkImportService.bulkImportItems(items, validateWithScryfall, conventionId);
            res.json(result);
        }
    }
    catch (err) {
        next(err);
    }
});
// --- Orders ---
// POST /api/store/purchase - Player purchases item (deducts tix immediately)
router.post('/purchase', async (req, res, next) => {
    try {
        const { user_id, item_id, quantity } = req.body;
        if (!user_id || !item_id) {
            return res.status(400).json({ error: 'user_id and item_id are required' });
        }
        const result = await storeService.purchaseItem(user_id, item_id, quantity || 1);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/store/reserve - Player reserves item (no tix charge)
router.post('/reserve', async (req, res, next) => {
    try {
        const { user_id, item_id, quantity } = req.body;
        if (!user_id || !item_id) {
            return res.status(400).json({ error: 'user_id and item_id are required' });
        }
        const result = await storeService.reserveItem(user_id, item_id, quantity || 1);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/store/orders - List orders (admin, optional ?status= and ?user_id=)
router.get('/orders', async (req, res, next) => {
    try {
        const status = req.query.status;
        const userId = req.query.user_id ? parseInt(req.query.user_id) : undefined;
        const orders = await storeService.getOrders({ status, userId, limit: 100 });
        res.json({ success: true, orders });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/store/orders/user/:userId - Get user's orders
router.get('/orders/user/:userId', async (req, res, next) => {
    try {
        const orders = await storeService.getUserOrders(parseInt(req.params.userId));
        res.json({ success: true, orders });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/store/orders/:id/fulfill - Fulfill order (admin)
router.post('/orders/:id/fulfill', async (req, res, next) => {
    try {
        const order = await storeService.fulfillOrder(parseInt(req.params.id), req.body.admin_note);
        res.json({ success: true, order });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/store/orders/:id/cancel - Cancel order (admin)
router.post('/orders/:id/cancel', async (req, res, next) => {
    try {
        const result = await storeService.cancelOrder(parseInt(req.params.id));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/reset-data - Reset all data (Super Admin only)
router.post('/admin/reset-data', async (req, res, next) => {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const { confirm } = req.body;
        if (confirm !== 'RESET_ALL_DATA') {
            return res.status(400).json({ error: 'Confirmation required. Send { "confirm": "RESET_ALL_DATA" }' });
        }
        // Delete in order to respect foreign key constraints
        await client.query('DELETE FROM event_matches');
        await client.query('DELETE FROM event_rounds');
        await client.query('DELETE FROM event_participants');
        await client.query('DELETE FROM events');
        await client.query('DELETE FROM store_orders');
        await client.query('DELETE FROM store_items');
        await client.query('DELETE FROM transactions');
        // Reset user balances and vouchers (delete users except super admins)
        await client.query('DELETE FROM users WHERE is_admin = FALSE');
        await client.query('COMMIT');
        res.json({ success: true, message: 'All data reset successfully' });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=store.js.map