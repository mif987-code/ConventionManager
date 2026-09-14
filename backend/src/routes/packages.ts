import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import * as packageService from '../services/packageService';

const router = Router();

// File upload config for merchandise images
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/merchandise'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'merch-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// POST /api/packages/upload-merchandise-image - Upload merchandise image
router.post('/upload-merchandise-image', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imageUrl = `/uploads/merchandise/${req.file.filename}`;
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages - List packages for current convention
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    const packages = await packageService.getPackagesByConvention(conventionId);
    res.json({ success: true, packages });
  } catch (err) {
    next(err);
  }
});

// POST /api/packages - Create package
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { conventionId } = req;
  if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
  try {
    const { name, description, days, cost, prereg_cost, regular_voucher_amount, package_type } = req.body;

    if (!name || days === undefined || days === null || cost === undefined) {
      return res.status(400).json({ error: 'name, days, and cost are required' });
    }
    if (days < 0) {
      return res.status(400).json({ error: 'days cannot be negative' });
    }

    const pkg = await packageService.createPackage(
      conventionId,
      name,
      description || null,
      days,
      cost,
      prereg_cost || null,
      regular_voucher_amount || 0,
      package_type || 'day_pass'
    );
    res.status(201).json({ success: true, package: pkg });
  } catch (err) {
    next(err);
  }
});

// PUT /api/packages/:id - Update package
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, days, cost, prereg_cost, regular_voucher_amount, is_active, package_type } = req.body;
    if (days !== undefined && days !== null && days < 0) {
      return res.status(400).json({ error: 'days cannot be negative' });
    }
    const pkg = await packageService.updatePackage(
      parseInt(req.params.id),
      name,
      description || null,
      days,
      cost,
      prereg_cost || null,
      regular_voucher_amount || 0,
      is_active,
      package_type || 'day_pass'
    );
    res.json({ success: true, package: pkg });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/packages/:id - Delete package
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await packageService.deletePackage(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:id/special-vouchers - Get special vouchers for a package
router.get('/:id/special-vouchers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const voucherIds = await packageService.getSpecialVouchersForPackage(parseInt(req.params.id));
    res.json({ success: true, special_voucher_ids: voucherIds });
  } catch (err) {
    next(err);
  }
});

// POST /api/packages/:id/special-vouchers/:voucherId - Add special voucher to package
router.post('/:id/special-vouchers/:voucherId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await packageService.addSpecialVoucherToPackage(parseInt(req.params.id), parseInt(req.params.voucherId));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/packages/:id/special-vouchers/:voucherId - Remove special voucher from package
router.delete('/:id/special-vouchers/:voucherId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await packageService.removeSpecialVoucherFromPackage(parseInt(req.params.id), parseInt(req.params.voucherId));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/:id/merchandise - Get merchandise for a package
router.get('/:id/merchandise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await packageService.getMerchandiseForPackage(parseInt(req.params.id));
    res.json({ success: true, merchandise: items });
  } catch (err) {
    next(err);
  }
});

// PUT /api/packages/:id/merchandise - Update merchandise for a package
router.put('/:id/merchandise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body; // array of item names (strings)
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array of strings' });
    }
    await packageService.setPackageMerchandise(parseInt(req.params.id), items);
    const updated = await packageService.getMerchandiseForPackage(parseInt(req.params.id));
    res.json({ success: true, merchandise: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/packages/user/:userId/merchandise - Get all merchandise assigned to a user
router.get('/user/:userId/merchandise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await packageService.getUserMerchandise(parseInt(req.params.userId));
    res.json({ success: true, merchandise: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/packages/user-merchandise/:id/claim - Claim an item for a user
router.post('/user-merchandise/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const claimedBy = (req as any).user?.username || (req as any).user?.name || 'admin';
    const item = await packageService.claimUserMerchandise(parseInt(req.params.id), claimedBy);
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

// POST /api/packages/user-merchandise/:id/unclaim - Unclaim an item for a user
router.post('/user-merchandise/:id/unclaim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await packageService.unclaimUserMerchandise(parseInt(req.params.id));
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

export default router;
