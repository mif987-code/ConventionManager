"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRToken = generateQRToken;
exports.verifyQRToken = verifyQRToken;
exports.generateQRImage = generateQRImage;
exports.storeIssuedToken = storeIssuedToken;
exports.isTokenUsed = isTokenUsed;
exports.markTokenAsUsed = markTokenAsUsed;
exports.cleanupExpiredTokens = cleanupExpiredTokens;
exports.checkRateLimit = checkRateLimit;
exports.calculateRiskScore = calculateRiskScore;
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const db_1 = require("../config/db");
// Secret key for signing QR tokens (should be in environment variables in production)
const SECRET_KEY = process.env.QR_SECRET_KEY || 'change-this-secret-key-in-production';
// Generate a signed QR token
function generateQRToken(userId, expiresInHours = 24) {
    const payload = {
        user_id: userId,
        exp: Date.now() + (expiresInHours * 60 * 60 * 1000), // Convert hours to milliseconds
        nonce: crypto_1.default.randomBytes(8).toString('hex'),
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto_1.default
        .createHmac('sha256', SECRET_KEY)
        .update(payloadBase64)
        .digest('hex');
    return `${payloadBase64}.${signature}`;
}
// Verify and decode a QR token
function verifyQRToken(token) {
    const parts = token.split('.');
    if (parts.length !== 2) {
        throw new Error('Invalid token format');
    }
    const [payloadBase64, signature] = parts;
    // Verify signature
    const expectedSig = crypto_1.default
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
async function generateQRImage(token) {
    return await qrcode_1.default.toDataURL(token);
}
// Store issued token in database
async function storeIssuedToken(userId, token, expiresAt) {
    await db_1.pool.query('INSERT INTO qr_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
}
// Check if token has already been used (anti-replay)
async function isTokenUsed(token) {
    const result = await db_1.pool.query('SELECT 1 FROM used_qr_tokens WHERE token = $1', [token]);
    return result.rows.length > 0;
}
// Mark token as used
async function markTokenAsUsed(token, userId) {
    await db_1.pool.query('INSERT INTO used_qr_tokens (token, user_id) VALUES ($1, $2)', [token, userId]);
}
// Clean up expired tokens (run periodically)
async function cleanupExpiredTokens() {
    await db_1.pool.query('DELETE FROM qr_tokens WHERE expires_at < NOW()');
    await db_1.pool.query('DELETE FROM used_qr_tokens WHERE used_at < NOW() - INTERVAL \'7 days\'');
}
// Rate limiting for scans (simple in-memory map)
const scanAttempts = new Map();
function checkRateLimit(identifier, maxScans = 5, windowMs = 5000) {
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
function calculateRiskScore(multiDevice, highFrequency, tokenReuse) {
    let risk = 0;
    if (multiDevice)
        risk += 3;
    if (highFrequency)
        risk += 2;
    if (tokenReuse)
        risk += 5;
    return risk;
}
//# sourceMappingURL=qrTokenService.js.map