"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNfcScan = handleNfcScan;
const userService_1 = require("./userService");
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
//# sourceMappingURL=nfcService.js.map