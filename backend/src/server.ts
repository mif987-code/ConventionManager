import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { testConnection } from './config/db';
import { apiKeyAuth, conventionMiddleware, errorHandler } from './middleware/auth';
import { startBackupSchedule } from './services/backupService';

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

// API Key auth on all /api routes
app.use('/api', apiKeyAuth);
app.use('/api', conventionMiddleware);

// Routes
app.use('/api/users', usersRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/scan', scanRouter);
app.use('/api/tix', tixRouter);
app.use('/api/prize-templates', prizeTemplatesRouter);
app.use('/api/store', storeRouter);
app.use('/api/stats', statsRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/conventions', conventionsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/special-vouchers', specialVouchersRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/floor-plan', floorPlanRouter);
app.use('/api/collectibles', collectiblesRouter);
app.use('/api/preregistrations', preregistrationsRouter);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve registration site static files
app.use('/register', express.static(path.join(__dirname, '../../registration-site')));

// Serve NFC registration PWA
app.use('/nfc', express.static(path.join(__dirname, '../../nfc-app')));

// Serve Player Store PWA (staff-facing)
app.use('/store', express.static(path.join(__dirname, '../../store-app')));

// Serve Player App PWA (player-facing)
app.use('/app', express.static(path.join(__dirname, '../../player-app')));

// Redirect root to the public registration form (NFC/admin apps stay reachable
// only at their explicit paths, e.g. /nfc, and are not linked from root).
app.get('/', (_req, res) => {
  res.redirect('/register/');
});

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  app.listen(PORT, () => {
    console.log(`[Server] Convention Manager API running on port ${PORT}`);
  });
}

start();
