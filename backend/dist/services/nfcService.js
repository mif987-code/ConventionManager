"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNfcScan = handleNfcScan;
exports.handleQrScan = handleQrScan;
exports.handleQrTokenScan = handleQrTokenScan;
exports.getUserByQrTokenWithBalances = getUserByQrTokenWithBalances;
const userService_1 = require("./userService");
const transactionService_1 = require("./transactionService");
const qrTokenService_1 = require("./qrTokenService");
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
// QR token scan handler — validates a signed QR token with security checks
async function handleQrTokenScan(token, deviceIdentifier) {
    try {
        // Rate limiting check
        if (deviceIdentifier && !(0, qrTokenService_1.checkRateLimit)(deviceIdentifier, 5, 5000)) {
            return {
                found: false,
                message: 'Rate limit exceeded. Please wait before scanning again.',
            };
        }
        // Verify token signature and decode payload
        const payload = (0, qrTokenService_1.verifyQRToken)(token);
        // Check if token has already been used (anti-replay protection)
        if (await (0, qrTokenService_1.isTokenUsed)(token)) {
            return {
                found: false,
                message: 'This QR code has already been used. Please generate a new one.',
            };
        }
        // Get user by ID from token
        const user = await (0, userService_1.getUserById)(payload.user_id);
        if (!user) {
            return {
                found: false,
                message: 'User not found',
            };
        }
        // Get user balances
        const voucherBalance = await (0, transactionService_1.getBalance)(user.id, 'voucher');
        const tixBalance = await (0, transactionService_1.getBalance)(user.id, 'tix');
        // Mark token as used
        await (0, qrTokenService_1.markTokenAsUsed)(token, user.id);
        return {
            found: true,
            user: {
                ...user,
                voucher_balance: voucherBalance,
                tix_balance: tixBalance,
            },
        };
    }
    catch (error) {
        return {
            found: false,
            message: error.message || 'Invalid QR code',
        };
    }
}
// Get user by QR token with balances
async function getUserByQrTokenWithBalances(token, deviceIdentifier) {
    const result = await handleQrTokenScan(token, deviceIdentifier);
    return result.found ? result.user : null;
}
//# sourceMappingURL=nfcService.js.map