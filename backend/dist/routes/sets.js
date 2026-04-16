"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const setService_1 = require("../services/setService");
const router = (0, express_1.Router)();
// GET /api/sets - Get all sets (with optional search)
router.get('/', (req, res) => {
    const { q } = req.query;
    if (q && typeof q === 'string') {
        const results = (0, setService_1.searchSets)(q);
        res.json({ sets: results });
    }
    else {
        const allSets = (0, setService_1.getAllSets)();
        res.json({ sets: allSets });
    }
});
exports.default = router;
//# sourceMappingURL=sets.js.map