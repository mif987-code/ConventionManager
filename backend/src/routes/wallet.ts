import { Router, Request, Response, NextFunction } from 'express';
import * as walletService from '../services/walletService';

const router = Router();

// GET /api/wallet/:userId/balance - Get the user's current credit balance
router.get('/:userId/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const balance = await walletService.getBalance(userId, conventionId);
    res.json({ success: true, balance });
  } catch (err) {
    next(err);
  }
});

// GET /api/wallet/:userId/history - Get the user's credit history
router.get('/:userId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await walletService.getHistory(userId, conventionId, limit, offset);
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

// POST /api/wallet/:userId/deposit - Add credit to the user's wallet
router.post('/:userId/deposit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const { amount_cents, payment_link } = req.body;
    const createdBy = req.adminId ? String(req.adminId) : 'system';

    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }

    const transaction = await walletService.deposit(userId, conventionId, amount_cents, createdBy, payment_link);
    res.status(201).json({ success: true, transaction, balance: await walletService.getBalance(userId, conventionId) });
  } catch (err) {
    next(err);
  }
});

// POST /api/wallet/:userId/pay - Charge the user's wallet for an event or item
router.post('/:userId/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const { amount_cents, event_id, reason } = req.body;
    const createdBy = req.adminId ? String(req.adminId) : 'system';

    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }

    const transaction = await walletService.pay(userId, conventionId, amount_cents, createdBy, event_id, reason);
    res.status(201).json({ success: true, transaction, balance: await walletService.getBalance(userId, conventionId) });
  } catch (err) {
    next(err);
  }
});

// POST /api/wallet/:userId/refund - Refund credit to the user's wallet
router.post('/:userId/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const { amount_cents, event_id, reason } = req.body;
    const createdBy = req.adminId ? String(req.adminId) : 'system';

    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }

    const transaction = await walletService.refund(userId, conventionId, amount_cents, createdBy, event_id, reason);
    res.status(201).json({ success: true, transaction, balance: await walletService.getBalance(userId, conventionId) });
  } catch (err) {
    next(err);
  }
});

// POST /api/wallet/:userId/adjust - Admin adjustment (positive or negative)
router.post('/:userId/adjust', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const conventionId = req.conventionId as number;
    const { amount_cents, reason } = req.body;
    const createdBy = req.adminId ? String(req.adminId) : 'system';

    if (!Number.isInteger(amount_cents)) {
      return res.status(400).json({ error: 'amount_cents must be an integer' });
    }

    const transaction = await walletService.adjust(userId, conventionId, amount_cents, createdBy, reason);
    res.status(201).json({ success: true, transaction, balance: await walletService.getBalance(userId, conventionId) });
  } catch (err) {
    next(err);
  }
});

export default router;
