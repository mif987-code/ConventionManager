import { Router, Request, Response, NextFunction } from 'express';
import * as adminSettingsService from '../services/adminSettingsService';

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
    const userId = (req as any).userId; // From auth middleware
    
    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }

    await adminSettingsService.setSetting(req.params.key, value, userId);
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/settings/qr-secret-key - Update QR secret key (super-admin only)
router.put('/qr-secret-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;
    const userId = (req as any).userId;
    const user = (req as any).user;
    
    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }

    // Check if user is super-admin
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Only super-admins can update QR secret key' });
    }

    await adminSettingsService.setQRSecretKey(value, userId);
    res.json({ success: true, message: 'QR secret key updated' });
  } catch (err) {
    next(err);
  }
});

export default router;
