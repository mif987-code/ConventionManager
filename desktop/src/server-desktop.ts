import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { testConnection } from '../../backend/src/config/db';
import { apiKeyAuth, conventionMiddleware, errorHandler } from '../../backend/src/middleware/auth';

import usersRouter from '../../backend/src/routes/users';
import vouchersRouter from '../../backend/src/routes/vouchers';
import eventsRouter from '../../backend/src/routes/events';
import scanRouter from '../../backend/src/routes/scan';
import tixRouter from '../../backend/src/routes/tix';
import prizeTemplatesRouter from '../../backend/src/routes/prizeTemplates';
import publicRegistrationRouter from '../../backend/src/routes/publicRegistration';
import storeRouter from '../../backend/src/routes/store';
import statsRouter from '../../backend/src/routes/stats';
import permissionsRouter from '../../backend/src/routes/permissions';
import playerRouter from '../../backend/src/routes/player';
import conventionsRouter from '../../backend/src/routes/conventions';
import setsRouter from '../../backend/src/routes/sets';
import cardsRouter from '../../backend/src/routes/cards';
import adminSettingsRouter from '../../backend/src/routes/adminSettings';
import attendanceRouter from '../../backend/src/routes/attendance';
import specialVouchersRouter from '../../backend/src/routes/specialVouchers';
import packagesRouter from '../../backend/src/routes/packages';
import paymentsRouter from '../../backend/src/routes/payments';
import floorPlanRouter from '../../backend/src/routes/floorPlan';

// Load env from multiple locations
dotenv.config();
const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Determine if running as packaged executable
const isPackaged = process.pkg !== undefined;

// Get base directory for static files
function getBaseDir(): string {
  if (isPackaged) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '../..');
}

const baseDir = getBaseDir();
console.log(`[Server] Running from: ${baseDir} (packaged: ${isPackaged})`);

// Middleware
app.use(cors({
  origin: true,
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

// Public routes (no API key required)
app.use('/public', publicRegistrationRouter);
app.use('/player', playerRouter);
app.use('/api/sets', setsRouter);
app.use('/api/cards', cardsRouter);

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
app.use('/api/floor-plan', floorPlanRouter);

// Serve admin panel static files (the main UI)
const adminPanelPath = isPackaged 
  ? path.join(baseDir, 'admin-panel', 'dist')
  : path.join(baseDir, 'admin-panel', 'dist');
  
if (fs.existsSync(adminPanelPath)) {
  app.use('/admin', express.static(adminPanelPath));
  app.use('/', express.static(adminPanelPath));
  console.log(`[Server] Serving admin panel from: ${adminPanelPath}`);
} else {
  console.warn(`[Server] Admin panel not found at: ${adminPanelPath}`);
}

// Serve registration site static files
const registrationPath = isPackaged
  ? path.join(baseDir, 'registration-site')
  : path.join(baseDir, 'registration-site');
  
if (fs.existsSync(registrationPath)) {
  app.use('/register', express.static(registrationPath));
  console.log(`[Server] Serving registration site from: ${registrationPath}`);
}

// Serve NFC registration PWA
const nfcPath = isPackaged
  ? path.join(baseDir, 'nfc-app')
  : path.join(baseDir, 'nfc-app');
  
if (fs.existsSync(nfcPath)) {
  app.use('/nfc', express.static(nfcPath));
  console.log(`[Server] Serving NFC app from: ${nfcPath}`);
}

// Serve Player Store PWA
const storePath = isPackaged
  ? path.join(baseDir, 'store-app')
  : path.join(baseDir, 'store-app');
  
if (fs.existsSync(storePath)) {
  app.use('/store', express.static(storePath));
  console.log(`[Server] Serving store app from: ${storePath}`);
}

// Serve Player App PWA
const playerPath = isPackaged
  ? path.join(baseDir, 'player-app')
  : path.join(baseDir, 'player-app');
  
if (fs.existsSync(playerPath)) {
  app.use('/app', express.static(playerPath));
  console.log(`[Server] Serving player app from: ${playerPath}`);
}

// SPA fallback - serve index.html for any unmatched routes (except API)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/public') || req.path.startsWith('/player')) {
    return next();
  }
  
  const indexPath = path.join(adminPanelPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Admin panel not found. Please build the frontend first.');
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: isPackaged ? 'packaged' : 'development'
  });
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

  app.listen(PORT, () => {
    console.log(`[Server] Convention Manager running on port ${PORT}`);
    console.log(`[Server] Admin Panel: http://localhost:${PORT}/`);
    console.log(`[Server] NFC App: http://localhost:${PORT}/nfc/`);
    console.log(`[Server] Store App: http://localhost:${PORT}/store/`);
    console.log(`[Server] Player App: http://localhost:${PORT}/app/`);
    console.log(`[Server] Registration: http://localhost:${PORT}/register/`);
  });
}

start();
