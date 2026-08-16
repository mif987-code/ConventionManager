import fs from 'fs';
import axios from 'axios';

// Dropbox backup upload via the HTTP Content API (no SDK dependency needed).
// Configured via env vars:
//   DROPBOX_ACCESS_TOKEN   - access token generated from the Dropbox App Console
//   DROPBOX_BACKUP_FOLDER  - optional destination folder path, e.g. "/ConventionManagerBackups" (defaults to root "/")
// If DROPBOX_ACCESS_TOKEN is missing, uploads are silently skipped (local-disk backups still run).

export function isDropboxBackupConfigured(): boolean {
  return Boolean(process.env.DROPBOX_ACCESS_TOKEN);
}

export async function uploadBackupToDropbox(filePath: string, filename: string): Promise<void> {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) return; // Dropbox upload not configured; local-disk backup already done

  const folder = (process.env.DROPBOX_BACKUP_FOLDER || '').replace(/\/+$/, '');
  const destPath = `${folder}/${filename}`;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    await axios.post('https://content.dropboxapi.com/2/files/upload', fileBuffer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: destPath,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log(`[Backup] Uploaded to Dropbox: ${destPath}`);
  } catch (err: any) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[Backup] Dropbox upload failed for ${filename}:`, detail);
  }
}
