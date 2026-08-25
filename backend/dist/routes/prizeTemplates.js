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
const prizeTemplateService = __importStar(require("../services/prizeTemplateService"));
const router = (0, express_1.Router)();
// GET /api/prize-templates - List all templates (optionally filter by ?rounds=N)
router.get('/', async (req, res, next) => {
    try {
        const rounds = req.query.rounds ? parseInt(req.query.rounds) : undefined;
        const templates = rounds
            ? await prizeTemplateService.getPrizeTemplatesByRounds(rounds)
            : await prizeTemplateService.getAllPrizeTemplates();
        res.json({ success: true, templates });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/prize-templates/:id
router.get('/:id', async (req, res, next) => {
    try {
        const template = await prizeTemplateService.getPrizeTemplateById(parseInt(req.params.id));
        if (!template)
            return res.status(404).json({ error: 'Prize template not found' });
        res.json({ success: true, template });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/prize-templates - Create
router.post('/', async (req, res, next) => {
    try {
        const { name, rounds, prize_structure, prize_structure_ties, is_placement } = req.body;
        if (!name || !rounds || !prize_structure || !prize_structure_ties) {
            return res.status(400).json({ error: 'name, rounds, prize_structure, and prize_structure_ties are required' });
        }
        const template = await prizeTemplateService.createPrizeTemplate(name, rounds, prize_structure, prize_structure_ties, !!is_placement);
        res.status(201).json({ success: true, template });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/prize-templates/:id - Update
router.put('/:id', async (req, res, next) => {
    try {
        const template = await prizeTemplateService.updatePrizeTemplate(parseInt(req.params.id), req.body);
        res.json({ success: true, template });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/prize-templates/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await prizeTemplateService.deletePrizeTemplate(parseInt(req.params.id));
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=prizeTemplates.js.map