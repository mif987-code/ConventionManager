"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getQRSecretKey = getQRSecretKey;
exports.setQRSecretKey = setQRSecretKey;
exports.getAllSettings = getAllSettings;
const db_1 = require("../config/db");
// Get a setting by key
async function getSetting(key) {
    const result = await db_1.pool.query('SELECT value FROM admin_settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
}
// Set a setting value
async function setSetting(key, value, updatedBy = null) {
    await db_1.pool.query(`INSERT INTO admin_settings (key, value, updated_by) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (key) 
     DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`, [key, value, updatedBy]);
}
// Get QR secret key (with fallback to environment variable)
async function getQRSecretKey() {
    // First try database setting
    const dbValue = await getSetting('qr_secret_key');
    if (dbValue && dbValue !== 'change-this-secret-key-in-production') {
        return dbValue;
    }
    // Fallback to environment variable
    return process.env.QR_SECRET_KEY || 'change-this-secret-key-in-production';
}
// Set QR secret key
async function setQRSecretKey(value, updatedBy) {
    await setSetting('qr_secret_key', value, updatedBy);
}
// Get all settings (admin only)
async function getAllSettings() {
    const result = await db_1.pool.query('SELECT key, value, updated_at, updated_by FROM admin_settings ORDER BY key');
    return result.rows;
}
//# sourceMappingURL=adminSettingsService.js.map