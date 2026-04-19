import { generateQRToken, generateQRImage, storeIssuedToken } from '../services/qrTokenService';
import { pool } from '../config/db';

const QR_EXPIRY_HOURS = 24;

/**
 * Issues a new QR code for a user: generates token, stores it, generates image,
 * and updates the users table. Returns the base64 QR image string.
 */
export async function issueQRCode(userId: number): Promise<string> {
  const token = await generateQRToken(userId, QR_EXPIRY_HOURS);
  const expiresAt = new Date(Date.now() + QR_EXPIRY_HOURS * 60 * 60 * 1000);

  await storeIssuedToken(userId, token, expiresAt);

  const qrImage = await generateQRImage(token);

  await pool.query('UPDATE users SET qr_code = $1 WHERE id = $2', [qrImage, userId]);

  return qrImage;
}
