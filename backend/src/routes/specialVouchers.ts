import { Router, Request, Response, NextFunction } from 'express';
import * as specialVoucherService from '../services/specialVoucherService';

const router = Router();

// GET /api/special-vouchers?convention_id=X - Get all special vouchers for a convention
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conventionId = req.query.convention_id ? parseInt(req.query.convention_id as string) : undefined;
    if (conventionId) {
      const vouchers = await specialVoucherService.getSpecialVouchersByConvention(conventionId);
      res.json({ success: true, special_vouchers: vouchers });
    } else {
      res.status(400).json({ error: 'convention_id query parameter is required' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/special-vouchers - Create a special voucher (tied to an Event Type category + entry cost)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { convention_id, category, entry_cost, name, amount, description, icon, color, max_awards } = req.body;

    if (!convention_id || !category || entry_cost === undefined || !name || amount === undefined) {
      return res.status(400).json({ error: 'convention_id, category, entry_cost, name, and amount are required' });
    }

    const voucher = await specialVoucherService.createSpecialVoucher(
      convention_id,
      category,
      entry_cost,
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

// GET /api/special-vouchers/event/:eventId - Get special vouchers matching a live event's category + entry cost
router.get('/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const vouchers = await specialVoucherService.getSpecialVouchersMatchingEvent(eventId);
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
    if (!Number.isInteger(user_id) || user_id < 1) {
      return res.status(400).json({ error: 'user_id must be a positive integer' });
    }
    if (!Number.isInteger(event_id) || event_id < 1) {
      return res.status(400).json({ error: 'event_id must be a positive integer' });
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

// GET /api/special-vouchers/user/:userId - Get all special vouchers awarded to a user in the current convention
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const { conventionId } = req;
    if (!conventionId) return res.status(400).json({ error: 'Convention ID required' });
    const awards = await specialVoucherService.getUserSpecialVoucherAwards(userId, conventionId);
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
