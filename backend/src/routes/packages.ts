import { Router, Request, Response, NextFunction } from 'express';
import * as packageService from '../services/packageService';

const router = Router();

// GET /api/packages - List packages for current convention
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const packages = await packageService.getPackagesByConvention(conventionId);
    res.json({ success: true, packages });
  } catch (err) {
    next(err);
  }
});

// POST /api/packages - Create package
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conventionId } = req;
    const { name, description, days, cost, prereg_cost, regular_voucher_amount } = req.body;

    if (!name || !days || cost === undefined) {
      return res.status(400).json({ error: 'name, days, and cost are required' });
    }

    const pkg = await packageService.createPackage(
      conventionId,
      name,
      description || null,
      days,
      cost,
      prereg_cost || null,
      regular_voucher_amount || 0
    );
    res.status(201).json({ success: true, package: pkg });
  } catch (err) {
    next(err);
  }
});

// PUT /api/packages/:id - Update package
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, days, cost, prereg_cost, regular_voucher_amount, is_active } = req.body;
    const pkg = await packageService.updatePackage(
      parseInt(req.params.id),
      name,
      description || null,
      days,
      cost,
      prereg_cost || null,
      regular_voucher_amount || 0,
      is_active
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

export default router;
