import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { pool, testConnection } from './config/db';
import { adminAuth, conventionMiddleware, errorHandler, requirePermission } from './middleware/auth';
import { startBackupSchedule } from './services/backupService';
import { startBackgroundJobs } from './services/backgroundJobService';
import { expirePendingPackagePayments } from './services/paymentService';

import usersRouter from './routes/users';
import vouchersRouter from './routes/vouchers';
import eventsRouter from './routes/events';
import scanRouter from './routes/scan';
import tixRouter from './routes/tix';
import prizeTemplatesRouter from './routes/prizeTemplates';
import publicRegistrationRouter from './routes/publicRegistration';
import storeRouter from './routes/store';
import statsRouter from './routes/stats';
import permissionsRouter from './routes/permissions';
import playerRouter from './routes/player';
import conventionsRouter from './routes/conventions';
import setsRouter from './routes/sets';
import cardsRouter from './routes/cards';
import adminSettingsRouter from './routes/adminSettings';
import attendanceRouter from './routes/attendance';
import specialVouchersRouter from './routes/specialVouchers';
import packagesRouter from './routes/packages';
import paymentsRouter from './routes/payments';
import paymentWebhooksRouter from './routes/paymentWebhooks';
import walletRouter from './routes/wallet';
import floorPlanRouter from './routes/floorPlan';
import collectiblesRouter from './routes/collectibles';
import preregistrationsRouter from './routes/preregistrations';
import adminAuthRouter from './routes/adminAuth';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Behind Render's proxy (and Cloudflare in front of it) — trust X-Forwarded-For so
// express-rate-limit and req.ip see the real client address.
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : [];
app.use(cors({
  origin: allowedOrigins.length > 0
    ? allowedOrigins
    : (process.env.NODE_ENV === 'development' ? true : false),
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

// Global backstop rate limit: guards against any single IP hammering any
// endpoint (registration bots, scripted abuse, etc.) hard enough to exhaust
// the DB connection pool or CPU. Individual sensitive endpoints (login,
// registration) have their own stricter limits on top of this.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}));

// Public routes (no API key required)
app.use('/public', publicRegistrationRouter);
app.use('/player', playerRouter);
app.use('/webhooks/payments', paymentWebhooksRouter); // payment provider webhooks
app.use('/api/sets', setsRouter); // Sets lookup (public, no auth needed)
app.use('/api/cards', cardsRouter); // Cards lookup (public, no auth needed)

// Admin login is public (adminAuth applies to other /api routes)
app.use('/api/admin/login', adminAuthRouter);

// API auth on all /api routes
app.use('/api', adminAuth);
app.use('/api', conventionMiddleware);

// Routes with permission enforcement
app.use('/api/users', requirePermission('users'), usersRouter);
app.use('/api/vouchers', requirePermission('vouchers'), vouchersRouter);
app.use('/api/events', requirePermission('events'), eventsRouter);
app.use('/api/scan', requirePermission('register'), scanRouter);
app.use('/api/tix', requirePermission('tix'), tixRouter);
app.use('/api/prize-templates', requirePermission('super'), prizeTemplatesRouter);
app.use('/api/store', requirePermission('store'), storeRouter);
app.use('/api/stats', requirePermission('stats'), statsRouter);
app.use('/api/permissions', requirePermission('super'), permissionsRouter);
app.use('/api/conventions', requirePermission('super'), conventionsRouter);
app.use('/api/admin/settings', requirePermission('super'), adminSettingsRouter);
app.use('/api/attendance', requirePermission('register'), attendanceRouter);
app.use('/api/special-vouchers', requirePermission('super'), specialVouchersRouter);
app.use('/api/packages', requirePermission('super'), packagesRouter);
app.use('/api/payments', requirePermission('super'), paymentsRouter);
app.use('/api/wallet', requirePermission('super'), walletRouter);
app.use('/api/floor-plan', requirePermission('super'), floorPlanRouter);
app.use('/api/collectibles', requirePermission('super'), collectiblesRouter);
app.use('/api/preregistrations', requirePermission('events'), preregistrationsRouter);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/brand', express.static(path.join(__dirname, '../../brand-assets')));

// Serve registration site static files
app.use('/register', express.static(path.join(__dirname, '../../registration-site')));

// Serve NFC registration PWA
app.use('/nfc', express.static(path.join(__dirname, '../../nfc-app')));

// Serve Player Store PWA (staff-facing)
app.use('/store', express.static(path.join(__dirname, '../../store-app')));

// Serve Player App PWA (player-facing)
app.use('/app', express.static(path.join(__dirname, '../../player-app')));

// Serve Admin Panel React build
app.use('/admin', express.static(path.join(__dirname, '../../admin-panel/dist')));
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'));
});

// Redirect root to the public registration form (NFC/admin apps stay reachable
// only at their explicit paths, e.g. /nfc, and are not linked from root).
app.get('/', (_req, res) => {
  res.redirect('/register/');
});

// Health check (no auth required)
app.get('/health', async (_req, res) => {
  try {
    const operational = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM payments WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes') AS stale_payments,
         (SELECT COUNT(*)::int FROM inventory_reservations WHERE status = 'reserved' AND expires_at <= NOW()) AS expired_reservations,
         (SELECT COUNT(*)::int FROM background_jobs WHERE status IN ('pending', 'failed')) AS queued_jobs`
    );
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 8) || 'local',
      database: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      operational: operational.rows[0],
      email: {
        resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
        senderConfigured: Boolean(process.env.EMAIL_FROM),
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), error: 'Database health check failed' });
  }
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('[Server] Cannot start without database connection');
    process.exit(1);
  }

  startBackupSchedule();
  startBackgroundJobs();
  void expirePendingPackagePayments().catch(err => console.error('[Payments] Reservation cleanup failed:', err));
  const reservationTimer = setInterval(() => {
    void expirePendingPackagePayments().catch(err => console.error('[Payments] Reservation cleanup failed:', err));
  }, 60000);
  reservationTimer.unref();

  app.listen(PORT, () => {
    console.log(`[Server] Convention Manager API running on port ${PORT}`);
  });
}

start();
