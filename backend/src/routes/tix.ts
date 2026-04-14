import { Router, Request, Response, NextFunction } from 'express';
import { getBalance, getTransactionHistory, addTransaction } from '../services/transactionService';

const router = Router();

// GET /api/tix/balance/:userId - Get tix balance
router.get('/balance/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const balance = await getBalance(userId, 'tix');
    res.json({ success: true, user_id: userId, balance });
  } catch (err) {
    next(err);
  }
});

// GET /api/tix/history/:userId - Get tix transaction history
router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await getTransactionHistory(userId, 'tix', limit, offset);
    res.json({ success: true, transactions });
  } catch (err) {
    next(err);
  }
});

// POST /api/tix/adjust - Admin tix adjustment
router.post('/adjust', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, amount } = req.body;

    if (!user_id || amount === undefined) {
      return res.status(400).json({ error: 'user_id and amount are required' });
    }

    await addTransaction({
      userId: user_id,
      type: 'tix',
      amount: amount,
      reason: 'admin_adjust',
      createdBy: 'admin',
    });

    const newBalance = await getBalance(user_id, 'tix');
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    next(err);
  }
});

export default router;
