"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionService_1 = require("../services/transactionService");
const router = (0, express_1.Router)();
// POST /api/vouchers/topup - Admin adds vouchers to a user
router.post('/topup', async (req, res, next) => {
    try {
        const { user_id, amount } = req.body;
        if (!user_id || !amount || amount <= 0) {
            return res.status(400).json({ error: 'user_id and positive amount are required' });
        }
        // Server-defined value — never trust client for transaction amounts in real flows
        await (0, transactionService_1.addTransaction)({
            userId: user_id,
            type: 'voucher',
            amount: amount,
            reason: 'topup',
            createdBy: 'admin',
        });
        const newBalance = await (0, transactionService_1.getBalance)(user_id, 'voucher');
        res.json({ success: true, new_balance: newBalance });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/vouchers/adjust - Admin adjustment (can be negative)
router.post('/adjust', async (req, res, next) => {
    try {
        const { user_id, amount, reason } = req.body;
        if (!user_id || amount === undefined) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }
        await (0, transactionService_1.addTransaction)({
            userId: user_id,
            type: 'voucher',
            amount: amount,
            reason: 'admin_adjust',
            createdBy: 'admin',
        });
        const newBalance = await (0, transactionService_1.getBalance)(user_id, 'voucher');
        res.json({ success: true, new_balance: newBalance });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/vouchers/balance/:userId - Get voucher balance
router.get('/balance/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const balance = await (0, transactionService_1.getBalance)(userId, 'voucher');
        res.json({ success: true, user_id: userId, balance });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/vouchers/history/:userId - Get voucher transaction history
router.get('/history/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const transactions = await (0, transactionService_1.getTransactionHistory)(userId, 'voucher', limit, offset);
        res.json({ success: true, transactions });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=vouchers.js.map