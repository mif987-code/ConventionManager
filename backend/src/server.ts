import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { testConnection } from './config/db';
import { apiKeyAuth, errorHandler } from './middleware/auth';

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

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json());

// Public routes (no API key required)
app.use('/public', publicRegistrationRouter);
app.use('/player', playerRouter);

// API Key auth on all /api routes
app.use('/api', apiKeyAuth);

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

// Serve registration site static files
app.use('/register', express.static(path.join(__dirname, '../../registration-site')));

// Serve NFC registration PWA
app.use('/nfc', express.static(path.join(__dirname, '../../nfc-app')));

// Serve Player Store PWA
app.use('/store', express.static(path.join(__dirname, '../../store-app')));

// Serve Player App PWA
app.use('/app', express.static(path.join(__dirname, '../../player-app')));

// Redirect root to NFC admin app
app.get('/', (_req, res) => {
  res.redirect('/nfc/');
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

  app.listen(PORT, () => {
    console.log(`[Server] Convention Manager API running on port ${PORT}`);
  });
}

start();
