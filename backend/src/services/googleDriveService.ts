import { google } from 'googleapis';
import fs from 'fs';

// Google Drive backup upload. Configured via env vars so it works both
// locally and on Render (no file-based credentials needed):
//   GOOGLE_SERVICE_ACCOUNT_JSON     - the full service account key JSON, as a single-line string
//   GOOGLE_DRIVE_BACKUP_FOLDER_ID   - the Drive folder ID to upload backups into
// If either is missing, uploads are silently skipped (local-disk backups still run).

let cachedDrive: ReturnType<typeof google.drive> | null = null;

function getCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Drive] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', (err as Error).message);
    return null;
  }
}

function getDriveClient() {
  if (cachedDrive) return cachedDrive;
  const credentials = getCredentials();
  if (!credentials) return null;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

export function isDriveBackupConfigured(): boolean {
  return Boolean(process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID && getCredentials());
}

export async function uploadBackupToDrive(filePath: string, filename: string): Promise<void> {
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
  if (!folderId) return; // Drive backup not configured; local-disk backup already done
  const drive = getDriveClient();
  if (!drive) return;

  try {
    await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/sql', body: fs.createReadStream(filePath) },
      fields: 'id',
    });
    console.log(`[Backup] Uploaded to Google Drive: ${filename}`);
  } catch (err) {
    console.error(`[Backup] Google Drive upload failed for ${filename}:`, (err as Error).message);
  }
}
