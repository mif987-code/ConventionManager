import { Router, Request, Response, NextFunction } from 'express';
import * as specialVoucherService from '../services/specialVoucherService';

const router = Router();

// POST /api/special-vouchers - Create a special voucher
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_id, name, amount, description, icon, color, max_awards } = req.body;

    if (!event_id || !name || amount === undefined) {
      return res.status(400).json({ error: 'event_id, name, and amount are required' });
    }

    const voucher = await specialVoucherService.createSpecialVoucher(
      event_id,
      name,
      amount,
      description,
      icon,
      color,
      max_awards
    );
    res.status(201).json({ success: true, special_voucher: voucher });
  } catch (err) {
    next(err);
  }
});

// GET /api/special-vouchers/event/:eventId - Get all special vouchers for an event
router.get('/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const vouchers = await specialVoucherService.getSpecialVouchersByEvent(eventId);
    res.json({ success: true, special_vouchers: vouchers });
  } catch (err) {
    next(err);
  }
});

// GET /api/special-vouchers/:id - Get a special voucher by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const voucher = await specialVoucherService.getSpecialVoucherById(id);
    if (!voucher) {
      return res.status(404).json({ error: 'Special voucher not found' });
    }
    res.json({ success: true, special_voucher: voucher });
  } catch (err) {
    next(err);
  }
});

// PUT /api/special-vouchers/:id - Update a special voucher
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const voucher = await specialVoucherService.updateSpecialVoucher(id, req.body);
    res.json({ success: true, special_voucher: voucher });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/special-vouchers/:id - Delete a special voucher
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await specialVoucherService.deleteSpecialVoucher(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/special-vouchers/:id/award - Award a special voucher to a user
router.post('/:id/award', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { user_id, event_id, awarded_by } = req.body;

    if (!user_id || !event_id) {
      return res.status(400).json({ error: 'user_id and event_id are required' });
    }

    const award = await specialVoucherService.awardSpecialVoucher(
      id,
      user_id,
      event_id,
      awarded_by || 'admin'
    );
    res.status(201).json({ success: true, award });
  } catch (err) {
    next(err);
  }
});

// GET /api/special-vouchers/:id/awards - Get awards for a special voucher
router.get('/:id/awards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const awards = await specialVoucherService.getSpecialVoucherAwards(id);
    res.json({ success: true, awards });
  } catch (err) {
    next(err);
  }
});

// GET /api/special-vouchers/user/:userId/event/:eventId - Get special vouchers for a user in an event
router.get('/user/:userId/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const eventId = parseInt(req.params.eventId);
    const awards = await specialVoucherService.getUserSpecialVouchersForEvent(userId, eventId);
    res.json({ success: true, awards });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/special-vouchers/awards/:awardId - Delete an award
router.delete('/awards/:awardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const awardId = parseInt(req.params.awardId);
    await specialVoucherService.deleteSpecialVoucherAward(awardId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
