import { Router, Request, Response, NextFunction } from 'express';
import * as adminSettingsService from '../services/adminSettingsService';
import { runFullBackup } from '../services/backupService';

const router = Router();

// GET /api/admin/settings - Get all settings (admin only)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await adminSettingsService.getAllSettings();
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/settings/:key - Get a specific setting (admin only)
router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const value = await adminSettingsService.getSetting(req.params.key);
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ success: true, key: req.params.key, value });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings/:key - Update a setting (admin only)
router.put('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;

    if (value === undefined || value === null || value === '') {
      return res.status(400).json({ error: 'value is required' });
    }

    await adminSettingsService.setSetting(req.params.key, value, undefined);
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings/qr-secret-key - Update QR secret key
router.put('/qr-secret-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;

    if (!value || typeof value !== 'string' || value.length < 16) {
      return res.status(400).json({ error: 'value must be a string of at least 16 characters' });
    }

    await adminSettingsService.setQRSecretKey(value, undefined);
    res.json({ success: true, message: 'QR secret key updated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/settings/backup-now - Trigger an immediate full DB backup + Dropbox upload
router.post('/backup-now', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runFullBackup();
    res.json({ success: true, message: 'Backup completed', filename: result.filename });
  } catch (err) {
    next(err);
  }
});

export default router;
