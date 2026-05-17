import { pool } from '../config/db';

export interface AdminSetting {
  key: string;
  value: string;
  updated_at: Date;
  updated_by: number | null;
}

// Get a setting by key
export async function getSetting(key: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT value FROM admin_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value || null;
}

// Set a setting value
export async function setSetting(key: string, value: string, updatedBy: number | null = null): Promise<void> {
  await pool.query(
    `INSERT INTO admin_settings (key, value, updated_by) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (key) 
     DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
    [key, value, updatedBy]
  );
}

// Get QR secret key (with fallback to environment variable)
export async function getQRSecretKey(): Promise<string> {
  // First try database setting
  const dbValue = await getSetting('qr_secret_key');
  if (dbValue && dbValue !== 'change-this-secret-key-in-production') {
    return dbValue;
  }
  
  // Fallback to environment variable
  return process.env.QR_SECRET_KEY || 'change-this-secret-key-in-production';
}

// Set QR secret key
export async function setQRSecretKey(value: string, updatedBy?: number): Promise<void> {
  await setSetting('qr_secret_key', value, updatedBy ?? null);
}

// Get all settings (admin only)
export async function getAllSettings(): Promise<AdminSetting[]> {
  const result = await pool.query(
    'SELECT key, value, updated_at, updated_by FROM admin_settings ORDER BY key'
  );
  return result.rows;
}
