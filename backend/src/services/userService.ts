import { pool } from '../config/db';
import { getBalance } from './transactionService';
import { getBalance as getWalletBalance } from './walletService';
import { setUserAttendance } from './attendanceService';
import { issueQRCode } from '../utils/qr';

export interface User {
  id: number;
  name: string;
  last_name: string | null;
  nfc_uid: string | null;
  qr_code: string | null;
  email: string | null;
  age: number | null;
  dob: string | null;
  is_admin: boolean;
  admin_permissions: string[];
  is_preregistered: boolean;
  is_active: boolean;
  activated_at: Date | null;
  activated_by: number | null;
  days_playing: number;
  convention_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function createUser(
  name: string,
  nfcUid?: string,
  email?: string,
  isAdmin = false,
  conventionId?: number,
  attendanceDates?: Date[]
): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (name, nfc_uid, email, is_admin, convention_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, nfcUid ?? null, email ?? null, isAdmin, conventionId ?? null]
  );

  const user: User = result.rows[0];

  if (attendanceDates && attendanceDates.length > 0 && conventionId) {
    await setUserAttendance(user.id, conventionId, attendanceDates);
  }

  user.qr_code = await issueQRCode(user.id);
  return user;
}

export async function getUserByNfcUid(nfcUid: string, conventionId?: number): Promise<User | null> {
  const query = conventionId
    ? `SELECT * FROM users WHERE nfc_uid = $1 AND convention_id = $2`
    : `SELECT * FROM users WHERE nfc_uid = $1`;
  const params = conventionId ? [nfcUid, conventionId] : [nfcUid];
  const result = await pool.query(query, params);
  return result.rows[0] ?? null;
}

export async function getUserByQrCode(qrCode: string, conventionId?: number): Promise<User | null> {
  const query = conventionId
    ? `SELECT * FROM users WHERE qr_code = $1 AND convention_id = $2`
    : `SELECT * FROM users WHERE qr_code = $1`;
  const params = conventionId ? [qrCode, conventionId] : [qrCode];
  const result = await pool.query(query, params);
  return result.rows[0] ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getAllUsers(conventionId?: number): Promise<User[]> {
  const query = conventionId
    ? `SELECT * FROM users WHERE convention_id = $1 ORDER BY created_at DESC`
    : `SELECT * FROM users ORDER BY created_at DESC`;
  const params = conventionId ? [conventionId] : [];
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getUserWithBalances(userId: number, conventionId?: number) {
  const user = await getUserById(userId);
  if (!user) return null;
  const [voucherBalance, tixBalance, creditBalance] = await Promise.all([
    getBalance(userId, 'voucher'),
    getBalance(userId, 'tix'),
    getWalletBalance(userId, conventionId ?? (user.convention_id as number)),
  ]);
  return { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance, credit_balance: creditBalance };
}

export async function getUserByNfcUidWithBalances(nfcUid: string, conventionId?: number) {
  const user = await getUserByNfcUid(nfcUid);
  if (!user) return null;
  const [voucherBalance, tixBalance, creditBalance] = await Promise.all([
    getBalance(user.id, 'voucher'),
    getBalance(user.id, 'tix'),
    getWalletBalance(user.id, conventionId ?? (user.convention_id as number)),
  ]);
  return { ...user, voucher_balance: voucherBalance, tix_balance: tixBalance, credit_balance: creditBalance };
}

export async function updateUser(
  id: number,
  fields: Partial<Pick<User, 'name' | 'nfc_uid' | 'email' | 'days_playing' | 'is_admin'>>
): Promise<User | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (fields.name !== undefined)        { setClauses.push(`name = $${paramIndex++}`);        values.push(fields.name); }
  if (fields.nfc_uid !== undefined)     { setClauses.push(`nfc_uid = $${paramIndex++}`);     values.push(fields.nfc_uid); }
  if (fields.email !== undefined)       { setClauses.push(`email = $${paramIndex++}`);       values.push(fields.email); }
  if (fields.days_playing !== undefined){ setClauses.push(`days_playing = $${paramIndex++}`);values.push(fields.days_playing); }
  if (fields.is_admin !== undefined)    { setClauses.push(`is_admin = $${paramIndex++}`);    values.push(fields.is_admin); }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function searchUsers(query: string, conventionId?: number): Promise<User[]> {
  const q = `%${query}%`;
  const result = conventionId
    ? await pool.query(
        `SELECT * FROM users WHERE convention_id = $1 AND (name ILIKE $2 OR last_name ILIKE $2 OR nfc_uid ILIKE $2 OR email ILIKE $2) ORDER BY name`,
        [conventionId, q]
      )
    : await pool.query(
        `SELECT * FROM users WHERE name ILIKE $1 OR last_name ILIKE $1 OR nfc_uid ILIKE $1 OR email ILIKE $1 ORDER BY name`,
        [q]
      );
  return result.rows;
}

export async function regenerateQRCode(userId: number): Promise<User> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');
  user.qr_code = await issueQRCode(userId);
  return user;
}

export async function activateUser(userId: number, adminId: number): Promise<User | null> {
  const result = await pool.query(
    `UPDATE users SET is_active = TRUE, activated_at = NOW(), activated_by = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [adminId, userId]
  );
  return result.rows[0] ?? null;
}

export async function deactivateUser(userId: number): Promise<User | null> {
  const result = await pool.query(
    `UPDATE users SET is_active = FALSE, activated_at = NULL, activated_by = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteUser(userId: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  return (result.rowCount ?? 0) > 0;
}
