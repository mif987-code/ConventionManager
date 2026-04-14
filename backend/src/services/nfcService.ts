import { getUserByNfcUidWithBalances } from './userService';

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
