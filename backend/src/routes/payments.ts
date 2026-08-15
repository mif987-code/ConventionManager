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

// POST /api/payments/webhook - Generic webhook (mock / internal use)
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) {
      return res.status(400).json({ error: 'paymentId and status are required' });
    }
    await paymentService.handlePaymentWebhook(paymentId, status);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  TILOPAY — redirect return URL (GET) + IPN webhook (POST)
//  TiloPay redirects the browser back to TILOPAY_REDIRECT_URL after payment.
//  It also sends an IPN (Instant Payment Notification) POST to the same URL
//  or a separate configured IPN URL.
//  Query/body params: orderNumber, approved (true/false), authorizationCode
// ─────────────────────────────────────────────────────────────────────────────
async function handleTilopayNotification(params: any, res: Response) {
  const orderId = params.orderNumber || params.order_number;
  const approved = params.approved === 'true' || params.approved === true || params.approved === '1';

  if (!orderId) {
    res.status(400).send('Missing orderNumber');
    return;
  }

  try {
    await paymentService.handlePaymentWebhook(orderId, approved ? 'paid' : 'failed');
  } catch (err: any) {
    console.error('[TiloPay] Webhook error:', err.message);
  }
  res.status(200).send('OK');
}

router.get('/tilopay-return', async (req: Request, res: Response) => {
  await handleTilopayNotification(req.query, res);
});

router.post('/tilopay-return', async (req: Request, res: Response) => {
  await handleTilopayNotification({ ...req.query, ...req.body }, res);
});

// ─────────────────────────────────────────────────────────────────────────────
//  ONVO PAY — checkout-session webhook
//  ONVO sends a POST to the registered webhook URL with:
//  { type: 'checkout-session.succeeded' | 'payment-intent.succeeded' | ...,
//    data: { id, metadata: { orderId }, status } }
//  Register this URL in the ONVO dashboard → Developers → Webhooks
// ─────────────────────────────────────────────────────────────────────────────
router.post('/onvo-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (type === 'checkout-session.succeeded' || type === 'payment-intent.succeeded') {
      // orderId stored in metadata when session was created
      const orderId = data.metadata?.orderId || data.id;
      await paymentService.handlePaymentWebhook(orderId, 'paid');
    } else if (type === 'payment-intent.failed') {
      const orderId = data.metadata?.orderId || data.id;
      await paymentService.handlePaymentWebhook(orderId, 'failed');
    }
    // Always respond 200 so ONVO doesn't retry
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/onvo-return - ONVO redirect after checkout
router.get('/onvo-return', async (req: Request, res: Response) => {
  // ONVO redirects here after payment. The session result comes via webhook.
  // Just redirect the player to the app.
  res.redirect('/app');
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
