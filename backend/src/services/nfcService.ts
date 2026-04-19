import { getUserByNfcUidWithBalances, getUserByQrCode, getUserWithBalances, getUserById } from './userService';
import { getBalance } from './transactionService';
import { verifyQRToken, isTokenUsed, markTokenAsUsed, checkRateLimit } from './qrTokenService';
import { isUserAttendingOnDate, getUserAttendance } from './attendanceService';

export async function handleNfcScan(nfcUid: string) {
  const user = await getUserByNfcUidWithBalances(nfcUid);
  if (!user) {
    return { found: false, message: `No user found for NFC tag: ${nfcUid}` };
  }
  return { found: true, user };
}

export async function handleQrScan(qrCode: string) {
  const user = await getUserByQrCode(qrCode);
  if (!user) {
    return { found: false, message: 'No user found for QR code' };
  }

  const [voucherBalance, tixBalance] = await Promise.all([
    getBalance(user.id, 'voucher'),
    getBalance(user.id, 'tix'),
  ]);

  return { found: true, user: { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance } };
}

export async function handleQrTokenScan(token: string, deviceIdentifier?: string) {
  // Rate limit by device
  if (deviceIdentifier && !checkRateLimit(deviceIdentifier, 5, 5000)) {
    return { found: false, message: 'Rate limit exceeded. Please wait before scanning again.' };
  }

  // Verify signature and expiry
  let payload: Awaited<ReturnType<typeof verifyQRToken>>;
  try {
    payload = await verifyQRToken(token);
  } catch (err) {
    return { found: false, message: err instanceof Error ? err.message : 'Invalid QR code' };
  }

  // Anti-replay: reject already-used tokens
  if (await isTokenUsed(token)) {
    return { found: false, message: 'This QR code has already been used. Please generate a new one.' };
  }

  const user = await getUserById(payload.user_id);
  if (!user) {
    return { found: false, message: 'User not found' };
  }

  // If the convention tracks attendance, enforce that the user attends today.
  if (user.convention_id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceDates = await getUserAttendance(user.id, user.convention_id);
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
    getBalance(user.id, 'voucher'),
    getBalance(user.id, 'tix'),
  ]);

  await markTokenAsUsed(token, user.id);

  return { found: true, user: { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance } };
}
