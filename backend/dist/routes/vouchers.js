"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionService_1 = require("../services/transactionService");
const router = (0, express_1.Router)();
router.post('/topup', async (req, res, next) => {
    try {
        const { user_id, amount } = req.body;
        const { conventionId } = req;
        if (!user_id || !amount || amount <= 0) {
            res.status(400).json({ error: 'user_id and positive amount are required' });
            return;
        }
        await (0, transactionService_1.addTransaction)({ userId: user_id, type: 'voucher', amount, reason: 'topup', createdBy: 'admin', conventionId });
        const newBalance = await (0, transactionService_1.getBalance)(user_id, 'voucher', undefined, conventionId);
        res.json({ success: true, new_balance: newBalance });
    }
    catch (err) {
        next(err);
    }
});
router.post('/adjust', async (req, res, next) => {
    try {
        const { user_id, amount } = req.body;
        const { conventionId } = req;
        if (!user_id || amount === undefined) {
            res.status(400).json({ error: 'user_id and amount are required' });
            return;
        }
        await (0, transactionService_1.addTransaction)({ userId: user_id, type: 'voucher', amount, reason: 'admin_adjust', createdBy: 'admin', conventionId });
        const newBalance = await (0, transactionService_1.getBalance)(user_id, 'voucher', undefined, conventionId);
        res.json({ success: true, new_balance: newBalance });
    }
    catch (err) {
        next(err);
    }
});
router.get('/balance/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const balance = await (0, transactionService_1.getBalance)(userId, 'voucher', undefined, req.conventionId);
        res.json({ success: true, user_id: userId, balance });
    }
    catch (err) {
        next(err);
    }
});
router.get('/history/:userId', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        const transactions = await (0, transactionService_1.getTransactionHistory)(userId, 'voucher', limit, offset);
        res.json({ success: true, transactions });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=vouchers.js.map