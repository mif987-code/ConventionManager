"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNfcScan = handleNfcScan;
exports.handleQrScan = handleQrScan;
const userService_1 = require("./userService");
const transactionService_1 = require("./transactionService");
// NFC scan handler — resolves an NFC UID to a user with balances
async function handleNfcScan(nfcUid) {
    const user = await (0, userService_1.getUserByNfcUidWithBalances)(nfcUid);
    if (!user) {
        return {
            found: false,
            message: `No user found for NFC tag: ${nfcUid}`,
        };
    }
    return {
        found: true,
        user,
    };
}
// QR code scan handler — resolves a QR code to a user with balances
async function handleQrScan(qrCode) {
    const user = await (0, userService_1.getUserByQrCode)(qrCode);
    if (!user) {
        return {
            found: false,
            message: `No user found for QR code`,
        };
    }
    const voucherBalance = await (0, transactionService_1.getBalance)(user.id, 'voucher');
    const tixBalance = await (0, transactionService_1.getBalance)(user.id, 'tix');
    return {
        found: true,
        user: {
            ...user,
            voucher_balance: voucherBalance,
            tix_balance: tixBalance,
        },
    };
}
//# sourceMappingURL=nfcService.js.map