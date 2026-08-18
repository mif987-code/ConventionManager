import { Router, Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/paymentService';

const router = Router();

// POST /api/payments/create - Create a payment intent for top-up
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'userId and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const payment = await paymentService.createPayment(amount);
    await paymentService.storePayment(payment, userId);

    res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      paymentUrl: payment.paymentUrl,
      amount: payment.amount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook - Generic webhook for admin testing / mock use only.
// TiloPay and Onvo webhooks are now served by the public /webhooks/payments router
// so external payment providers are not blocked by API key auth and can sign
// their requests properly.
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) {
      return res.status(400).json({ error: 'paymentId and status are required' });
    }
    if (status !== 'paid' && status !== 'failed') {
      return res.status(400).json({ error: 'status must be paid or failed' });
    }
    await paymentService.handlePaymentWebhook(paymentId, status);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Get payment details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.getPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ success: true, payment });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/user/:userId - Get user's payment history
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await paymentService.getUserPayments(parseInt(req.params.userId));
    res.json({ success: true, payments });
  } catch (err) {
    next(err);
  }
});

export default router;
