import { getUserByNfcUidWithBalances, getUserByQrCode } from './userService';
import { getBalance } from './transactionService';

// NFC scan handler — resolves an NFC UID to a user with balances
export async function handleNfcScan(nfcUid: string) {
  const user = await getUserByNfcUidWithBalances(nfcUid);

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
export async function handleQrScan(qrCode: string) {
  const user = await getUserByQrCode(qrCode);
  
  if (!user) {
    return {
      found: false,
      message: `No user found for QR code`,
    };
  }

  const voucherBalance = await getBalance(user.id, 'voucher');
  const tixBalance = await getBalance(user.id, 'tix');

  return {
    found: true,
    user: {
      ...user,
      voucher_balance: voucherBalance,
      tix_balance: tixBalance,
    },
  };
}
