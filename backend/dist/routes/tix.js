"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionService_1 = require("../services/transactionService");
const router = (0, express_1.Router)();
// GET /api/tix/balance/:userId - Get tix balance
router.get('/balance/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const balance = await (0, transactionService_1.getBalance)(userId, 'tix');
        res.json({ success: true, user_id: userId, balance });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/tix/history/:userId - Get tix transaction history
router.get('/history/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const transactions = await (0, transactionService_1.getTransactionHistory)(userId, 'tix', limit, offset);
        res.json({ success: true, transactions });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/tix/adjust - Admin tix adjustment
router.post('/adjust', async (req, res, next) => {
    try {
        const { user_id, amount } = req.body;
        if (!user_id || amount === undefined) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }
        await (0, transactionService_1.addTransaction)({
            userId: user_id,
            type: 'tix',
            amount: amount,
            reason: 'admin_adjust',
            createdBy: 'admin',
        });
        const newBalance = await (0, transactionService_1.getBalance)(user_id, 'tix');
        res.json({ success: true, new_balance: newBalance });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=tix.js.map