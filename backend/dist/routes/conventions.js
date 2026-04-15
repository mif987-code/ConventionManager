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
const conventionService = __importStar(require("../services/conventionService"));
const router = (0, express_1.Router)();
// GET /api/conventions - List all conventions
router.get('/', async (req, res, next) => {
    try {
        const result = await conventionService.listConventions();
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/conventions - Create new convention
router.post('/', async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }
        const convention = await conventionService.createConvention(name);
        res.status(201).json({ success: true, convention });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/conventions/:id - Get convention details
router.get('/:id', async (req, res, next) => {
    try {
        const convention = await conventionService.getConvention(parseInt(req.params.id));
        if (!convention) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json({ success: true, convention });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/conventions/:id - Update convention
router.put('/:id', async (req, res, next) => {
    try {
        const convention = await conventionService.updateConvention(parseInt(req.params.id), req.body);
        if (!convention) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json({ success: true, convention });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/conventions/:id/end - End convention (lock it)
router.post('/:id/end', async (req, res, next) => {
    try {
        const convention = await conventionService.endConvention(parseInt(req.params.id));
        res.json({ success: true, convention });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/conventions/:id/stats - Get convention statistics
router.get('/:id/stats', async (req, res, next) => {
    try {
        const stats = await conventionService.getConventionStats(parseInt(req.params.id));
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/conventions/:id/export - Export convention data
router.get('/:id/export', async (req, res, next) => {
    try {
        const data = await conventionService.exportConvention(parseInt(req.params.id));
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/conventions/:id - Delete convention and all data
router.delete('/:id', async (req, res, next) => {
    try {
        await conventionService.deleteConvention(parseInt(req.params.id));
        res.json({ success: true, message: 'Convention deleted' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=conventions.js.map