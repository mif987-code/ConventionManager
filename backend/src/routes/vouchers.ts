import { Router, Request, Response, NextFunction } from 'express';
import { addTransaction, getBalance, getTransactionHistory } from '../services/transactionService';

const router = Router();

// POST /api/vouchers/topup - Admin adds vouchers to a user
router.post('/topup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, amount } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'user_id and positive amount are required' });
    }

    // Server-defined value — never trust client for transaction amounts in real flows
    await addTransaction({
      userId: user_id,
      type: 'voucher',
      amount: amount,
      reason: 'topup',
      createdBy: 'admin',
    });

    const newBalance = await getBalance(user_id, 'voucher');
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    next(err);
  }
});

// POST /api/vouchers/adjust - Admin adjustment (can be negative)
router.post('/adjust', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, amount, reason } = req.body;

    if (!user_id || amount === undefined) {
      return res.status(400).json({ error: 'user_id and amount are required' });
    }

    await addTransaction({
      userId: user_id,
      type: 'voucher',
      amount: amount,
      reason: 'admin_adjust',
      createdBy: 'admin',
    });

    const newBalance = await getBalance(user_id, 'voucher');
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    next(err);
  }
});

// GET /api/vouchers/balance/:userId - Get voucher balance
router.get('/balance/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const balance = await getBalance(userId, 'voucher');
    res.json({ success: true, user_id: userId, balance });
  } catch (err) {
    next(err);
  }
});

// GET /api/vouchers/history/:userId - Get voucher transaction history
router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await getTransactionHistory(userId, 'voucher', limit, offset);
    res.json({ success: true, transactions });
  } catch (err) {
    next(err);
  }
});

export default router;
