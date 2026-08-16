import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { uploadBackupToDrive, isDriveBackupConfigured } from './googleDriveService';

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Tables backed up every 15 minutes
const CRITICAL_TABLES = [
  'users',
  'user_attendance',
  'user_packages',
  'transactions',
  'special_vouchers',
  'special_voucher_awards',
  'events',
  'event_participants',
  'event_rounds',
  'event_matches',
  'payments',
];

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function cleanBackups(prefix: string, maxAgeMs: number) {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.sql'));
    const cutoff = Date.now() - maxAgeMs;
    for (const file of files) {
      const fullPath = path.join(BACKUP_DIR, file);
      const { mtime } = fs.statSync(fullPath);
      if (mtime.getTime() < cutoff) {
        fs.unlinkSync(fullPath);
        console.log(`[Backup] Deleted: ${file}`);
      }
    }
  } catch (err) {
    console.error('[Backup] Error cleaning backups:', err);
  }
}

// Override if `pg_dump` isn't on PATH (common on Windows dev machines, e.g.
// "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"). Defaults to relying on PATH.
const PG_DUMP_BIN = process.env.PG_DUMP_PATH || 'pg_dump';

function pgDump(filename: string, extraArgs: string, onDone: (err: Error | null) => void) {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_NAME || !DB_USER) {
    onDone(new Error('Missing DB env vars'));
    return;
  }
  const filepath = path.join(BACKUP_DIR, filename);
  const cmd = `"${PG_DUMP_BIN}" -h ${DB_HOST} -p ${DB_PORT || 5432} -U ${DB_USER} -d ${DB_NAME} ${extraArgs} -F p -f "${filepath}"`;
  exec(cmd, { env: { ...process.env, PGPASSWORD: DB_PASSWORD } }, (err) => {
    if (err && fs.existsSync(filepath)) fs.unlinkSync(filepath);
    onDone(err);
  });
}

function runFullBackup() {
  ensureBackupDir();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${dateStr}.sql`;
  console.log(`[Backup] Full backup starting: ${filename}`);
  pgDump(filename, '', async (err) => {
    if (err) {
      console.error(`[Backup] Full backup failed: ${err.message}`);
      return;
    }
    console.log(`[Backup] Full backup done: ${filename}`);
    cleanBackups('backup_', 7 * 24 * 60 * 60 * 1000); // keep 7 days
    await uploadBackupToDrive(path.join(BACKUP_DIR, filename), filename);
  });
}

function runQuickBackup() {
  ensureBackupDir();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `quick_${dateStr}.sql`;
  const tableArgs = CRITICAL_TABLES.map(t => `-t ${t}`).join(' ');
  pgDump(filename, tableArgs, async (err) => {
    if (err) {
      console.error(`[Backup] Quick backup failed: ${err.message}`);
      return;
    }
    console.log(`[Backup] Quick backup done: ${filename}`);
    cleanBackups('quick_', 24 * 60 * 60 * 1000); // keep 24 hours
    await uploadBackupToDrive(path.join(BACKUP_DIR, filename), filename);
  });
}

export function startBackupSchedule() {
  cron.schedule('0 2 * * *', runFullBackup);
  cron.schedule('*/15 * * * *', runQuickBackup);
  console.log('[Backup] Full backup scheduled at 02:00 daily (7-day retention)');
  console.log('[Backup] Quick backup scheduled every 15 min (24-hour retention)');
  console.log(isDriveBackupConfigured()
    ? '[Backup] Google Drive upload is ENABLED for every backup'
    : '[Backup] Google Drive upload is DISABLED (set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_BACKUP_FOLDER_ID to enable)');
}
