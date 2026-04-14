"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const statsService_1 = require("../services/statsService");
const router = (0, express_1.Router)();
// GET /api/stats - Get convention statistics
router.get('/', async (_req, res, next) => {
    try {
        const stats = await (0, statsService_1.getStats)();
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map