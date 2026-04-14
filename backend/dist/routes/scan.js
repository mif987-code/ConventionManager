"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nfcService_1 = require("../services/nfcService");
const router = (0, express_1.Router)();
// POST /api/scan - Scan NFC tag and return user info with balances
router.post('/', async (req, res, next) => {
    try {
        const { nfc_uid } = req.body;
        if (!nfc_uid) {
            return res.status(400).json({ error: 'nfc_uid is required' });
        }
        const result = await (0, nfcService_1.handleNfcScan)(nfc_uid);
        if (!result.found) {
            return res.status(404).json(result);
        }
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/scan/balance - Quick balance check via NFC
router.post('/balance', async (req, res, next) => {
    try {
        const { nfc_uid } = req.body;
        if (!nfc_uid) {
            return res.status(400).json({ error: 'nfc_uid is required' });
        }
        const result = await (0, nfcService_1.handleNfcScan)(nfc_uid);
        if (!result.found || !result.user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            user_id: result.user.id,
            name: result.user.name,
            voucher_balance: result.user.voucher_balance,
            tix_balance: result.user.tix_balance,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=scan.js.map