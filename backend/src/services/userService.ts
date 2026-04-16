import { pool } from '../config/db';
import { getBalance } from './transactionService';
import QRCode from 'qrcode';
import { generateQRToken, generateQRImage, storeIssuedToken } from './qrTokenService';
import { setUserAttendance } from './attendanceService';

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
  days_playing: number;
  convention_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function createUser(name: string, nfcUid?: string, email?: string, isAdmin: boolean = false, conventionId?: number, attendanceDates?: Date[]): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (name, nfc_uid, email, is_admin, convention_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, nfcUid || null, email || null, isAdmin, conventionId || null]
  );

  const user = result.rows[0];

  // Set attendance dates if provided and convention is set
  if (attendanceDates && attendanceDates.length > 0 && conventionId) {
    await setUserAttendance(user.id, conventionId, attendanceDates);
  }

  // Generate secure QR token
  const token = await generateQRToken(user.id, 24); // 24 hour expiration
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

  // Store the token in qr_tokens table
  await storeIssuedToken(user.id, token, expiresAt);

  // Generate QR code image from the token
  const qrCode = await generateQRImage(token);

  // Update user with QR code image
  await pool.query(
    `UPDATE users SET qr_code = $1 WHERE id = $2`,
    [qrCode, user.id]
  );

  user.qr_code = qrCode;

  return user;
}

export async function getUserByNfcUid(nfcUid: string, conventionId?: number): Promise<User | null> {
  const query = conventionId 
    ? `SELECT * FROM users WHERE nfc_uid = $1 AND convention_id = $2`
    : `SELECT * FROM users WHERE nfc_uid = $1`;
  const params = conventionId ? [nfcUid, conventionId] : [nfcUid];
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function getUserByQrCode(qrCode: string, conventionId?: number): Promise<User | null> {
  const query = conventionId 
    ? `SELECT * FROM users WHERE qr_code = $1 AND convention_id = $2`
    : `SELECT * FROM users WHERE qr_code = $1`;
  const params = conventionId ? [qrCode, conventionId] : [qrCode];
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await pool.query(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getAllUsers(conventionId?: number) {
  const query = conventionId
    ? `SELECT * FROM users WHERE convention_id = $1 ORDER BY created_at DESC`
    : `SELECT * FROM users ORDER BY created_at DESC`;
  const params = conventionId ? [conventionId] : [];
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getUserWithBalances(userId: number) {
  const user = await getUserById(userId);
  if (!user) return null;

  const voucherBalance = await getBalance(userId, 'voucher');
  const tixBalance = await getBalance(userId, 'tix');

  return {
    ...user,
    voucher_balance: voucherBalance,
    tix_balance: tixBalance,
  };
}

export async function getUserByNfcUidWithBalances(nfcUid: string) {
  const user = await getUserByNfcUid(nfcUid);
  if (!user) return null;

  const voucherBalance = await getBalance(user.id, 'voucher');
  const tixBalance = await getBalance(user.id, 'tix');

  return {
    ...user,
    voucher_balance: voucherBalance,
    tix_balance: tixBalance,
  };
}

export async function updateUser(id: number, fields: Partial<Pick<User, 'name' | 'nfc_uid' | 'email' | 'days_playing' | 'is_admin'>>) {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (fields.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(fields.name);
  }
  if (fields.nfc_uid !== undefined) {
    setClauses.push(`nfc_uid = $${paramIndex++}`);
    values.push(fields.nfc_uid);
  }
  if (fields.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(fields.email);
  }
  if (fields.days_playing !== undefined) {
    setClauses.push(`days_playing = $${paramIndex++}`);
    values.push(fields.days_playing);
  }
  if (fields.is_admin !== undefined) {
    setClauses.push(`is_admin = $${paramIndex++}`);
    values.push(fields.is_admin);
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function searchUsers(query: string) {
  const result = await pool.query(
    `SELECT * FROM users WHERE name ILIKE $1 OR last_name ILIKE $1 OR nfc_uid ILIKE $1 OR email ILIKE $1 ORDER BY name`,
    [`%${query}%`]
  );
  return result.rows;
}

// Regenerate QR code for an existing user
export async function regenerateQRCode(userId: number): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Generate new secure QR token
  const token = await generateQRToken(userId, 24); // 24 hour expiration
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

  // Store the token in qr_tokens table
  await storeIssuedToken(userId, token, expiresAt);

  // Generate QR code image from the token
  const qrCode = await generateQRImage(token);

  // Update user with new QR code image
  await pool.query(
    `UPDATE users SET qr_code = $1 WHERE id = $2`,
    [qrCode, userId]
  );

  user.qr_code = qrCode;

  return user;
}
