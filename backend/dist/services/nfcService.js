"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNfcScan = handleNfcScan;
exports.handleQrScan = handleQrScan;
exports.handleQrTokenScan = handleQrTokenScan;
const userService_1 = require("./userService");
const transactionService_1 = require("./transactionService");
const qrTokenService_1 = require("./qrTokenService");
const attendanceService_1 = require("./attendanceService");
async function handleNfcScan(nfcUid) {
    const user = await (0, userService_1.getUserByNfcUidWithBalances)(nfcUid);
    if (!user) {
        return { found: false, message: `No user found for NFC tag: ${nfcUid}` };
    }
    if (!user.is_active) {
        return { found: false, message: 'Account not activated. Please visit an admin to activate your account.' };
    }
    return { found: true, user };
}
async function handleQrScan(qrCode) {
    const user = await (0, userService_1.getUserByQrCode)(qrCode);
    if (!user) {
        return { found: false, message: 'No user found for QR code' };
    }
    if (!user.is_active) {
        return { found: false, message: 'Account not activated. Please visit an admin to activate your account.' };
    }
    const [voucherBalance, tixBalance] = await Promise.all([
        (0, transactionService_1.getBalance)(user.id, 'voucher'),
        (0, transactionService_1.getBalance)(user.id, 'tix'),
    ]);
    return { found: true, user: { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance } };
}
async function handleQrTokenScan(token, deviceIdentifier) {
    // Rate limit by device
    if (deviceIdentifier && !(0, qrTokenService_1.checkRateLimit)(deviceIdentifier, 5, 5000)) {
        return { found: false, message: 'Rate limit exceeded. Please wait before scanning again.' };
    }
    // Verify signature and expiry
    let payload;
    try {
        payload = await (0, qrTokenService_1.verifyQRToken)(token);
    }
    catch (err) {
        return { found: false, message: err instanceof Error ? err.message : 'Invalid QR code' };
    }
    // Anti-replay: reject already-used tokens
    if (await (0, qrTokenService_1.isTokenUsed)(token)) {
        return { found: false, message: 'This QR code has already been used. Please generate a new one.' };
    }
    const user = await (0, userService_1.getUserById)(payload.user_id);
    if (!user) {
        return { found: false, message: 'User not found' };
    }
    if (!user.is_active) {
        return { found: false, message: 'Account not activated. Please visit an admin to activate your account.' };
    }
    // If the convention tracks attendance, enforce that the user attends today.
    if (user.convention_id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const attendanceDates = await (0, attendanceService_1.getUserAttendance)(user.id, user.convention_id);
        if (attendanceDates.length > 0) {
            const attendsToday = attendanceDates.some((d) => {
                const date = new Date(d);
                date.setHours(0, 0, 0, 0);
                return date.getTime() === today.getTime();
            });
            if (!attendsToday) {
                return { found: false, message: 'User is not registered to attend today.' };
            }
        }
    }
    const [voucherBalance, tixBalance] = await Promise.all([
        (0, transactionService_1.getBalance)(user.id, 'voucher'),
        (0, transactionService_1.getBalance)(user.id, 'tix'),
    ]);
    await (0, qrTokenService_1.markTokenAsUsed)(token, user.id);
    return { found: true, user: { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance } };
}
//# sourceMappingURL=nfcService.js.map