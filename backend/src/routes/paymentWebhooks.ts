import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as paymentService from '../services/paymentService';

const router = Router();

// ONVO sends the webhook secret in this header.
const ONVO_WEBHOOK_SECRET = process.env.ONVO_WEBHOOK_SECRET;

// TiloPay redirects include a `hash` query/body param that proves the redirect
// came from TiloPay. The exact composition is configured via env vars so it can
// be adjusted without redeploying.
const TILOPAY_HASH_SECRET = process.env.TILOPAY_HASH_SECRET;
const TILOPAY_HASH_FIELDS = (process.env.TILOPAY_HASH_FIELDS || 'orderNumber,approved,authorizationCode').split(',').map(s => s.trim()).filter(Boolean);

function logWebhookVerificationMissing(provider: string, secretName: string) {
  console.warn(`[${provider}] Webhook verification disabled: ${secretName} not set. Set it before going live.`);
}

function verifyOnvoWebhook(req: Request, res: Response): boolean {
  if (!ONVO_WEBHOOK_SECRET) {
    logWebhookVerificationMissing('OnvoPay', 'ONVO_WEBHOOK_SECRET');
    return true;
  }

  const sent = req.headers['x-webhook-secret'] as string | undefined;
  if (!sent || sent !== ONVO_WEBHOOK_SECRET) {
    console.error('[OnvoPay] Webhook secret mismatch');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return false;
  }

  return true;
}

function getTilopayField(params: any, field: string): string {
  const value = params[field];
  return value === undefined || value === null ? '' : String(value);
}

function computeTilopayHash(params: any): string | null {
  if (!TILOPAY_HASH_SECRET) return null;

  const payload = TILOPAY_HASH_FIELDS.map(f => getTilopayField(params, f)).join('|');
  return crypto
    .createHmac('sha256', TILOPAY_HASH_SECRET)
    .update(payload)
    .digest('hex');
}

function verifyTilopayHash(params: any, res: Response): boolean {
  if (!TILOPAY_HASH_SECRET) {
    logWebhookVerificationMissing('TiloPay', 'TILOPAY_HASH_SECRET');
    return true;
  }

  const sentHash = (params.hash || '') as string;
  if (!sentHash) {
    console.error('[TiloPay] Missing hash parameter');
    res.status(401).send('Missing hash');
    return false;
  }

  const expected = computeTilopayHash(params);
  if (!expected || sentHash.toLowerCase() !== expected.toLowerCase()) {
    console.error('[TiloPay] Hash mismatch');
    res.status(401).send('Invalid hash');
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TILOPAY — redirect return URL (GET) + IPN webhook (POST)
//  TiloPay redirects the browser back to the redirect URL after payment.
//  It also sends an IPN POST to the same (or configured) URL.
//  Query/body params: orderNumber, approved, authorizationCode, hash
// ─────────────────────────────────────────────────────────────────────────────
async function handleTilopayNotification(params: any, res: Response) {
  if (!verifyTilopayHash(params, res)) return;

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
    if (!verifyOnvoWebhook(req, res)) return;

    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (type === 'checkout-session.succeeded' || type === 'payment-intent.succeeded') {
      const orderId = data.metadata?.orderId || data.id;
      await paymentService.handlePaymentWebhook(orderId, 'paid');
    } else if (type === 'payment-intent.failed' || type === 'checkout-session.failed') {
      const orderId = data.metadata?.orderId || data.id;
      await paymentService.handlePaymentWebhook(orderId, 'failed');
    }
    // Always respond 2xx so ONVO doesn't retry
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

// ONVO browser redirect after checkout — send the player to the receipt page
router.get('/onvo-return', async (req: Request, res: Response) => {
  const paymentId = req.query.paymentId as string | undefined;
  const frontendUrl = process.env.FRONTEND_URL || 'https://register.sparkfestcr.com/register';
  const receiptUrl = new URL(`${frontendUrl}/payment-success.html`);
  if (paymentId) {
    receiptUrl.searchParams.set('paymentId', paymentId);
  }
  res.redirect(receiptUrl.toString());
});

export default router;
