import { pool } from '../config/db';
import { addTransaction } from './transactionService';

export interface PaymentIntent {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  paymentUrl?: string;
  paymentLink?: string;
  amount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROVIDER SELECTION
//  Set PAYMENT_PROVIDER=tilopay | onvopay | mock in .env
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDER = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
//  TILOPAY  (Central America / Costa Rica)
//  Docs: https://web.tilopay.com/documentacion/sdk
//  Required env vars:
//    TILOPAY_API_KEY     – your API key from the Tilopay dashboard
//    TILOPAY_API_USER    – your API user/email
//    TILOPAY_REDIRECT_URL – URL to redirect after payment (your backend or frontend)
// ─────────────────────────────────────────────────────────────────────────────
async function createTilopayPayment(amount: number): Promise<PaymentIntent> {
  const apiKey = process.env.TILOPAY_API_KEY;
  const apiUser = process.env.TILOPAY_API_USER;
  const redirectUrl = process.env.TILOPAY_REDIRECT_URL || `${process.env.APP_URL || 'http://localhost:3000'}/webhooks/payments/tilopay-return`;

  if (!apiKey || !apiUser) {
    throw new Error('TILOPAY_API_KEY and TILOPAY_API_USER must be set in .env');
  }

  // Step 1: Authenticate to get access token
  const authRes = await fetch('https://app.tilopay.com/api/v1/loginSdk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiUser, apiKey }),
  });
  const authData = await authRes.json() as any;
  if (!authRes.ok || !authData.access_token) {
    throw new Error(`TiloPay auth failed: ${authData.message || authRes.status}`);
  }

  const orderId = 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  // Step 2: Create payment link
  const payRes = await fetch('https://app.tilopay.com/api/v1/charge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.access_token}`,
    },
    body: JSON.stringify({
      amount: amount.toFixed(2),
      currency: process.env.TILOPAY_CURRENCY || 'USD',
      orderNumber: orderId,
      redirect: redirectUrl,
      billToFirstName: 'Convention',
      billToLastName: 'Attendee',
    }),
  });
  const payData = await payRes.json() as any;
  if (!payRes.ok || !payData.redirect) {
    throw new Error(`TiloPay charge failed: ${payData.message || payRes.status}`);
  }

  return {
    id: orderId,
    status: 'pending',
    paymentUrl: payData.redirect,
    paymentLink: payData.redirect,
    amount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ONVO PAY  (Costa Rica — SINPE Móvil, cards)
//  Docs: https://docs.onvopay.com/checkout/one-time-links
//  Required env vars:
//    ONVO_SECRET_KEY     – onvo_live_sk_... or onvo_test_sk_...
//    ONVO_REDIRECT_URL   – success redirect URL
//    ONVO_CANCEL_URL     – cancel redirect URL
//    ONVO_CURRENCY       – CRC or USD (default: CRC)
// ─────────────────────────────────────────────────────────────────────────────
async function createOnvoPayment(amount: number): Promise<PaymentIntent> {
  const secretKey = process.env.ONVO_SECRET_KEY;
  const redirectBase = process.env.ONVO_REDIRECT_URL || `${process.env.APP_URL || 'http://localhost:3000'}/webhooks/payments/onvo-return`;
  const cancelUrl = process.env.ONVO_CANCEL_URL || `${process.env.APP_URL || 'http://localhost:3000'}/register`;
  const currency = process.env.ONVO_CURRENCY || 'CRC';

  if (!secretKey) {
    throw new Error('ONVO_SECRET_KEY must be set in .env');
  }

  // ONVO amounts are in the smallest unit: CRC uses colones * 100, USD uses cents * 100
  const unitAmount = Math.round(amount * 100);
  const orderId = 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  // Include our internal payment/order ID in the return URL so the receipt page
  // can look up the payment status without relying only on the webhook.
  const redirectUrl = new URL(redirectBase);
  redirectUrl.searchParams.set('paymentId', orderId);

  const res = await fetch('https://api.onvopay.com/v1/checkout/sessions/one-time-link', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lineItems: [{ quantity: 1, unitAmount, currency, description: `Convention payment ${orderId}` }],
      redirectUrl: redirectUrl.toString(),
      cancelUrl,
      metadata: { orderId },
    }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.url) {
    throw new Error(`OnvoPay checkout failed: ${JSON.stringify(data)}`);
  }

  return {
    id: data.id || orderId,
    status: 'pending',
    paymentUrl: data.url,
    paymentLink: data.url,
    amount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOCK  (development / testing)
// ─────────────────────────────────────────────────────────────────────────────
async function createMockPayment(amount: number): Promise<PaymentIntent> {
  const paymentId = 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  return {
    id: paymentId,
    status: 'pending',
    paymentUrl: `https://payment-mock.com/pay/${paymentId}`,
    paymentLink: `https://payment-mock.com/transaction/${paymentId}`,
    amount,
  };
}

export async function createPayment(amount: number): Promise<PaymentIntent> {
  if (PROVIDER === 'tilopay') return createTilopayPayment(amount);
  if (PROVIDER === 'onvopay') return createOnvoPayment(amount);
  return createMockPayment(amount);
}

export async function storePayment(payment: PaymentIntent, userId: number): Promise<void> {
  await pool.query(
    `INSERT INTO payments (id, user_id, amount, status, payment_url, payment_link)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [payment.id, userId, payment.amount, payment.status, payment.paymentUrl, payment.paymentLink]
  );
}

export async function getPayment(paymentId: string): Promise<any> {
  const result = await pool.query(
    `SELECT * FROM payments WHERE id = $1`,
    [paymentId]
  );
  return result.rows[0];
}

export async function updatePaymentStatus(paymentId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, paymentId]
  );
}

export async function handlePaymentWebhook(paymentId: string, status: string): Promise<void> {
  if (status !== 'paid' && status !== 'failed') {
    throw new Error(`Invalid payment status: ${status}`);
  }

  // Atomically claim this payment only if it is still pending. This makes the
  // webhook idempotent and prevents double-awarding from concurrent/replayed
  // notifications.
  const updateRes = await pool.query(
    `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *`,
    [status, paymentId]
  );

  if (updateRes.rowCount === 0) {
    // Either the payment doesn't exist or was already processed.
    const payment = await getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    return;
  }

  const payment = updateRes.rows[0];

  if (status === 'paid') {
    // Payment row is already atomically marked as 'paid' above.
    // Award vouchers based on the stored package / amount.

    // Check if user has a package selected
    const packageRes = await pool.query(
      `SELECT up.package_id, up.quantity, p.regular_voucher_amount, p.prereg_cost, p.cost
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = $1`,
      [payment.user_id]
    );

    if (packageRes.rows.length > 0) {
      const pkg = packageRes.rows[0];
      const quantity = pkg.quantity || 1;
      const unitCost = pkg.prereg_cost || pkg.cost;
      const packageTotal = unitCost * quantity;

      // If payment matches (or exceeds) the package total, award package vouchers
      if (Math.abs(payment.amount - packageTotal) < 0.01 && pkg.regular_voucher_amount > 0) {
        await addTransaction({
          userId: payment.user_id,
          type: 'voucher',
          amount: pkg.regular_voucher_amount,
          reason: 'purchase',
          createdBy: 'payment',
          paymentLink: payment.payment_link,
        });

        // Award special vouchers for this package
        const specialVouchersRes = await pool.query(
          `SELECT sv.id, sv.amount, sv.name
           FROM package_special_vouchers psv
           JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
           WHERE psv.package_id = $1`,
          [pkg.package_id]
        );

        for (const sv of specialVouchersRes.rows) {
          await pool.query(
            `INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
             VALUES ($1, $2, NULL, 'package_payment')`,
            [payment.user_id, sv.id]
          );
        }
      }
    } else {
      // No package, add vouchers directly (for top-up purchases)
      await addTransaction({
        userId: payment.user_id,
        type: 'voucher',
        amount: payment.amount,
        reason: 'purchase',
        createdBy: 'payment',
        paymentLink: payment.payment_link,
      });
    }
  } else if (status === 'failed') {
    await updatePaymentStatus(paymentId, 'failed');
  }
}

export async function getUserPayments(userId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}
