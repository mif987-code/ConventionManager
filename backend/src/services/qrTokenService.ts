import crypto from 'crypto';
import QRCode from 'qrcode';
import { pool } from '../config/db';

// Secret key for signing QR tokens (should be in environment variables in production)
const SECRET_KEY = process.env.QR_SECRET_KEY || 'change-this-secret-key-in-production';

export interface QRTokenPayload {
  user_id: number;
  exp: number;
  nonce: string;
}

// Generate a signed QR token
export function generateQRToken(userId: number, expiresInHours: number = 24): string {
  const payload: QRTokenPayload = {
    user_id: userId,
    exp: Date.now() + (expiresInHours * 60 * 60 * 1000), // Convert hours to milliseconds
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
}

// Verify and decode a QR token
export function verifyQRToken(token: string): QRTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadBase64, signature] = parts;

  // Verify signature
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadBase64)
    .digest('hex');

  if (signature !== expectedSig) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

  // Check expiration
  if (payload.exp < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

// Generate QR code image as base64
export async function generateQRImage(token: string): Promise<string> {
  return await QRCode.toDataURL(token);
}

// Store issued token in database
export async function storeIssuedToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  await pool.query(
    'INSERT INTO qr_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

// Check if token has already been used (anti-replay)
export async function isTokenUsed(token: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM used_qr_tokens WHERE token = $1',
    [token]
  );
  return result.rows.length > 0;
}

// Mark token as used
export async function markTokenAsUsed(token: string, userId: number): Promise<void> {
  await pool.query(
    'INSERT INTO used_qr_tokens (token, user_id) VALUES ($1, $2)',
    [token, userId]
  );
}

// Clean up expired tokens (run periodically)
export async function cleanupExpiredTokens(): Promise<void> {
  await pool.query(
    'DELETE FROM qr_tokens WHERE expires_at < NOW()'
  );
  await pool.query(
    'DELETE FROM used_qr_tokens WHERE used_at < NOW() - INTERVAL \'7 days\''
  );
}

// Rate limiting for scans (simple in-memory map)
const scanAttempts = new Map<string, number[]>();

export function checkRateLimit(identifier: string, maxScans: number = 5, windowMs: number = 5000): boolean {
  const now = Date.now();
  const attempts = scanAttempts.get(identifier) || [];
  
  // Filter out attempts outside the time window
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxScans) {
    return false; // Rate limit exceeded
  }
  
  recentAttempts.push(now);
  scanAttempts.set(identifier, recentAttempts);
  return true;
}

// Risk score calculation for fraud detection
export function calculateRiskScore(
  multiDevice: boolean,
  highFrequency: boolean,
  tokenReuse: boolean
): number {
  let risk = 0;
  if (multiDevice) risk += 3;
  if (highFrequency) risk += 2;
  if (tokenReuse) risk += 5;
  return risk;
}
