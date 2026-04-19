import { Router, Request, Response, NextFunction } from 'express';
import { getBalance, getTransactionHistory, addTransaction } from '../services/transactionService';

const router = Router();

router.get('/balance/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const balance = await getBalance(userId, 'tix', undefined, req.conventionId);
    res.json({ success: true, user_id: userId, balance });
  } catch (err) {
    next(err);
  }
});

router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const transactions = await getTransactionHistory(userId, 'tix', limit, offset);
    res.json({ success: true, transactions });
  } catch (err) {
    next(err);
  }
});

router.post('/adjust', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, amount } = req.body as { user_id: number; amount: number };
    const { conventionId } = req;

    if (!user_id || amount === undefined) {
      res.status(400).json({ error: 'user_id and amount are required' });
      return;
    }

    await addTransaction({ userId: user_id, type: 'tix', amount, reason: 'admin_adjust', createdBy: 'admin', conventionId });
    const newBalance = await getBalance(user_id, 'tix', undefined, conventionId);
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    next(err);
  }
});

export default router;
