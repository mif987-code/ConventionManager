"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBackupSchedule = startBackupSchedule;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_cron_1 = __importDefault(require("node-cron"));
const BACKUP_DIR = path_1.default.join(__dirname, '../../backups');
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
    if (!fs_1.default.existsSync(BACKUP_DIR)) {
        fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}
function cleanBackups(prefix, maxAgeMs) {
    try {
        const files = fs_1.default.readdirSync(BACKUP_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.sql'));
        const cutoff = Date.now() - maxAgeMs;
        for (const file of files) {
            const fullPath = path_1.default.join(BACKUP_DIR, file);
            const { mtime } = fs_1.default.statSync(fullPath);
            if (mtime.getTime() < cutoff) {
                fs_1.default.unlinkSync(fullPath);
                console.log(`[Backup] Deleted: ${file}`);
            }
        }
    }
    catch (err) {
        console.error('[Backup] Error cleaning backups:', err);
    }
}
function pgDump(filename, extraArgs, onDone) {
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_NAME || !DB_USER) {
        onDone(new Error('Missing DB env vars'));
        return;
    }
    const filepath = path_1.default.join(BACKUP_DIR, filename);
    const cmd = `pg_dump -h ${DB_HOST} -p ${DB_PORT || 5432} -U ${DB_USER} -d ${DB_NAME} ${extraArgs} -F p -f "${filepath}"`;
    (0, child_process_1.exec)(cmd, { env: { ...process.env, PGPASSWORD: DB_PASSWORD } }, (err) => {
        if (err && fs_1.default.existsSync(filepath))
            fs_1.default.unlinkSync(filepath);
        onDone(err);
    });
}
function runFullBackup() {
    ensureBackupDir();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${dateStr}.sql`;
    console.log(`[Backup] Full backup starting: ${filename}`);
    pgDump(filename, '', (err) => {
        if (err) {
            console.error(`[Backup] Full backup failed: ${err.message}`);
            return;
        }
        console.log(`[Backup] Full backup done: ${filename}`);
        cleanBackups('backup_', 7 * 24 * 60 * 60 * 1000); // keep 7 days
    });
}
function runQuickBackup() {
    ensureBackupDir();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `quick_${dateStr}.sql`;
    const tableArgs = CRITICAL_TABLES.map(t => `-t ${t}`).join(' ');
    pgDump(filename, tableArgs, (err) => {
        if (err) {
            console.error(`[Backup] Quick backup failed: ${err.message}`);
            return;
        }
        cleanBackups('quick_', 24 * 60 * 60 * 1000); // keep 24 hours
    });
}
function startBackupSchedule() {
    node_cron_1.default.schedule('0 2 * * *', runFullBackup);
    node_cron_1.default.schedule('*/15 * * * *', runQuickBackup);
    console.log('[Backup] Full backup scheduled at 02:00 daily (7-day retention)');
    console.log('[Backup] Quick backup scheduled every 15 min (24-hour retention)');
}
//# sourceMappingURL=backupService.js.map