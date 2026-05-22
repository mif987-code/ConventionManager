"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const statsService_1 = require("../services/statsService");
const router = (0, express_1.Router)();
// GET /api/stats - Get convention statistics
router.get('/', async (req, res, next) => {
    try {
        const stats = await (0, statsService_1.getStats)(req.conventionId ?? 0);
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map