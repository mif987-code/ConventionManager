import { getUserByNfcUidWithBalances, getUserByQrCode, getUserWithBalances, getUserById } from './userService';
import { getBalance } from './transactionService';
import { verifyQRToken, isTokenUsed, markTokenAsUsed, checkRateLimit, calculateRiskScore } from './qrTokenService';
import { isUserAttendingOnDate, getUserAttendance } from './attendanceService';

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

// QR token scan handler — validates a signed QR token with security checks
export async function handleQrTokenScan(token: string, deviceIdentifier?: string) {
  try {
    // Rate limiting check
    if (deviceIdentifier && !checkRateLimit(deviceIdentifier, 5, 5000)) {
      return {
        found: false,
        message: 'Rate limit exceeded. Please wait before scanning again.',
      };
    }

    // Verify token signature and decode payload
    const payload = await verifyQRToken(token);

    // Check if token has already been used (anti-replay protection)
    if (await isTokenUsed(token)) {
      return {
        found: false,
        message: 'This QR code has already been used. Please generate a new one.',
      };
    }

    // Get user by ID from token
    const user = await getUserById(payload.user_id);
    if (!user) {
      return {
        found: false,
        message: 'User not found',
      };
    }

    // Check if user is attending on the current date (if convention has dates set)
    if (user.convention_id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isAttending = await isUserAttendingOnDate(user.id, user.convention_id, today);
      
      // If attendance is tracked and user is not attending today, reject
      // We need to check if the convention has attendance tracking enabled
      // For now, we'll allow the scan if attendance is not set (backward compatibility)
      const attendanceDates = await getUserAttendance(user.id, user.convention_id);
      if (attendanceDates.length > 0) {
        const isAttendingToday = attendanceDates.some((date: Date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });
        
        if (!isAttendingToday) {
          return {
            found: false,
            message: 'User is not registered to attend today. Please check attendance dates.',
          };
        }
      }
    }

    // Get user balances
    const voucherBalance = await getBalance(user.id, 'voucher');
    const tixBalance = await getBalance(user.id, 'tix');

    // Mark token as used
    await markTokenAsUsed(token, user.id);

    return {
      found: true,
      user: {
        ...user,
        voucher_balance: voucherBalance,
        tix_balance: tixBalance,
      },
    };
  } catch (error: any) {
    return {
      found: false,
      message: error.message || 'Invalid QR code',
    };
  }
}

// Get user by QR token with balances
export async function getUserByQrTokenWithBalances(token: string, deviceIdentifier?: string) {
  const result = await handleQrTokenScan(token, deviceIdentifier);
  return result.found ? result.user : null;
}
