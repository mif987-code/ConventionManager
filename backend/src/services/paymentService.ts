import { PoolClient } from 'pg';
import { pool } from '../config/db';
import * as walletService from './walletService';

export type PaymentPurpose = 'topup' | 'package';

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
export const PROVIDER = (process.env.PAYMENT_PROVIDER || 'mock').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
console.log(`[Payments] Active provider: ${PROVIDER}`);

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
    signal: AbortSignal.timeout(parseInt(process.env.PAYMENT_API_TIMEOUT_MS || '20000', 10)),
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
    signal: AbortSignal.timeout(parseInt(process.env.PAYMENT_API_TIMEOUT_MS || '20000', 10)),
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
    signal: AbortSignal.timeout(parseInt(process.env.PAYMENT_API_TIMEOUT_MS || '20000', 10)),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.url) {
    throw new Error(`OnvoPay checkout failed: ${JSON.stringify(data)}`);
  }

  return {
    id: orderId,
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

export async function storePayment(payment: PaymentIntent, userId: number, purpose: PaymentPurpose = 'topup'): Promise<void> {
  await pool.query(
    `INSERT INTO payments (id, user_id, amount, status, payment_url, payment_link, purpose, provider, payer_name, payer_email)
     SELECT $1, u.id, $2, $3, $4, $5, $6, $7, NULLIF(TRIM(CONCAT_WS(' ', u.name, u.last_name)), ''), u.email
     FROM users u WHERE u.id = $8`,
    [payment.id, payment.amount, payment.status, payment.paymentUrl, payment.paymentLink, purpose, PROVIDER, userId]
  );
}

export async function storePackagePaymentWithReservations(payment: PaymentIntent, userIds: number[], transactionClient?: PoolClient): Promise<void> {
  const client = transactionClient || await pool.connect();
  const ownsTransaction = !transactionClient;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    const existing = await client.query(
      `SELECT DISTINCT p.id FROM payments p
       LEFT JOIN payment_package_users ppu ON ppu.payment_id = p.id
       WHERE p.status = 'pending' AND p.purpose = 'package'
         AND p.created_at > NOW() - ($2 * INTERVAL '1 minute')
         AND (p.user_id = ANY($1::int[]) OR ppu.user_id = ANY($1::int[]))
       LIMIT 1`,
      [userIds, parseInt(process.env.PAYMENT_RESERVATION_MINUTES || '30', 10)]
    );
    if (existing.rows.length > 0) throw Object.assign(new Error('A pending package payment already exists for this registration'), { status: 409 });
    await client.query(
      `INSERT INTO payments (id, user_id, amount, status, payment_url, payment_link, purpose, provider, payer_name, payer_email)
       SELECT $1, u.id, $2, $3, $4, $5, 'package', $6, NULLIF(TRIM(CONCAT_WS(' ', u.name, u.last_name)), ''), u.email
       FROM users u WHERE u.id = $7`,
      [payment.id, payment.amount, payment.status, payment.paymentUrl, payment.paymentLink, PROVIDER, userIds[0]]
    );
    for (const userId of userIds) {
      await client.query(
        `INSERT INTO payment_package_users (payment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [payment.id, userId]
      );
    }
    const items = await client.query(
      `SELECT up.user_id, up.package_id, pm.store_item_id, SUM(up.quantity)::int AS quantity
       FROM user_packages up
       JOIN package_merchandise pm ON pm.package_id = up.package_id
       WHERE up.user_id = ANY($1::int[]) AND pm.store_item_id IS NOT NULL
       GROUP BY up.user_id, up.package_id, pm.store_item_id
       ORDER BY pm.store_item_id`,
      [userIds]
    );
    const expiryMinutes = parseInt(process.env.PAYMENT_RESERVATION_MINUTES || '30', 10);
    for (const item of items.rows) {
      const stockResult = await client.query(
        `UPDATE store_items SET stock = stock - $2, updated_at = NOW()
         WHERE id = $1 AND stock >= $2 RETURNING stock`,
        [item.store_item_id, item.quantity]
      );
      if (stockResult.rows.length === 0) throw Object.assign(new Error('Merchandise sold out while creating checkout'), { status: 409 });
      await client.query(
        `INSERT INTO inventory_reservations (payment_id, user_id, package_id, store_item_id, quantity, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 minute'))`,
        [payment.id, item.user_id, item.package_id, item.store_item_id, item.quantity, expiryMinutes]
      );
    }
    if (ownsTransaction) await client.query('COMMIT');
  } catch (err) {
    if (ownsTransaction) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownsTransaction) client.release();
  }
}

async function releaseReservations(client: PoolClient, paymentId: string, status: 'released' | 'expired'): Promise<void> {
  const reservations = await client.query(
    `UPDATE inventory_reservations SET status = $2, updated_at = NOW()
     WHERE payment_id = $1 AND status = 'reserved'
     RETURNING store_item_id, quantity`,
    [paymentId, status]
  );
  for (const reservation of reservations.rows) {
    await client.query(
      `UPDATE store_items SET stock = stock + $2, updated_at = NOW() WHERE id = $1`,
      [reservation.store_item_id, reservation.quantity]
    );
  }
}

export async function expirePendingPackagePayments(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = await client.query(
      `SELECT payment_id FROM inventory_reservations
       WHERE status = 'reserved' AND expires_at <= NOW()
       FOR UPDATE SKIP LOCKED`
    );
    const paymentIds = Array.from(new Set(expired.rows.map((row: any) => row.payment_id))) as string[];
    for (const paymentId of paymentIds) {
      await releaseReservations(client, paymentId, 'expired');
      await client.query(`UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1 AND status = 'pending'`, [paymentId]);
    }
    await client.query('COMMIT');
    return paymentIds.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomically claim this payment only if it is still pending. This makes the
    // webhook idempotent and prevents double-crediting from concurrent/replayed
    // notifications.
    const updateRes = await client.query(
      `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 AND status = 'pending' RETURNING *`,
      [status, paymentId]
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      // Either the payment doesn't exist or was already processed.
      const payment = await getPayment(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }
      return;
    }

    const payment = updateRes.rows[0];

    if (status === 'paid') {
      if (payment.purpose === 'package') {
        const groupRes = await client.query(
          `SELECT user_id FROM payment_package_users WHERE payment_id = $1 ORDER BY user_id`,
          [payment.id]
        );
        const packageUserIds = groupRes.rows.length > 0
          ? groupRes.rows.map((row: any) => row.user_id)
          : [payment.user_id];
        const reserved = await client.query(
          `UPDATE inventory_reservations SET status = 'completed', updated_at = NOW()
           WHERE payment_id = $1 AND status = 'reserved' RETURNING id`,
          [payment.id]
        );
        for (const userId of packageUserIds) {
          await awardPaidPackages(client, userId, reserved.rows.length > 0);
        }
      } else {
        const userRes = await client.query(
          `SELECT convention_id FROM users WHERE id = $1`,
          [payment.user_id]
        );
        const conventionId: number | null = userRes.rows[0]?.convention_id ?? null;
        if (!conventionId) {
          throw new Error('Cannot deposit credit without a convention');
        }

        // Wallet stores whole CRC colones; payment.amount is already in colones.
        await walletService.deposit(
          payment.user_id,
          conventionId,
          Math.round(payment.amount),
          'payment',
          payment.payment_link,
          client
        );
      }
    } else {
      await releaseReservations(client, payment.id, 'released');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// A paid package grants the same benefits a free package grants at registration
// (see publicRegistration.ts): regular vouchers and linked special vouchers, per
// unit purchased. Package purchases never add wallet credit.
async function awardPaidPackages(client: any, userId: number, stockReserved: boolean): Promise<void> {
  const pkgRes = await client.query(
    `SELECT up.package_id, up.quantity, p.name, p.regular_voucher_amount,
            CASE WHEN p.prereg_cost IS NOT NULL
                      AND (p.prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= p.prereg_start_date)
                      AND (p.prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= p.prereg_end_date)
                 THEN p.prereg_cost ELSE p.cost END AS effective_cost
     FROM user_packages up
     JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = $1`,
    [userId]
  );

  for (const pkg of pkgRes.rows) {
    const quantity = pkg.quantity || 1;
    const unitCost = pkg.effective_cost;
    // Free packages were already awarded at registration time.
    if (!unitCost || unitCost <= 0) continue;

    if (pkg.regular_voucher_amount > 0) {
      await client.query(
        `INSERT INTO voucher_transactions (user_id, amount, description)
         VALUES ($1, $2, $3)`,
        [userId, pkg.regular_voucher_amount * quantity, `Package purchase (${pkg.name} x${quantity})`]
      );
    }

    const specialVouchersRes = await client.query(
      `SELECT sv.id
       FROM package_special_vouchers psv
       JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
       WHERE psv.package_id = $1`,
      [pkg.package_id]
    );

    for (const sv of specialVouchersRes.rows) {
      for (let i = 0; i < quantity; i++) {
        await client.query(
          `INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
           VALUES ($1, $2, NULL, 'package_payment')`,
          [userId, sv.id]
        );
      }
    }

    // Award package merchandise
    const merchandiseRes = await client.query(
      `SELECT item_name, image_url, store_item_id FROM package_merchandise WHERE package_id = $1`,
      [pkg.package_id]
    );
    const userRes = await client.query(`SELECT convention_id FROM users WHERE id = $1`, [userId]);
    const conventionId = userRes.rows[0]?.convention_id;

    for (const item of merchandiseRes.rows) {
      if (item.store_item_id && !stockReserved) {
        const stockResult = await client.query(
          `UPDATE store_items SET stock = stock - $2, updated_at = NOW()
           WHERE id = $1 AND stock >= $2 RETURNING stock`,
          [item.store_item_id, quantity]
        );
        if (stockResult.rows.length === 0) throw new Error(`Not enough merchandise stock: ${item.item_name}`);
      }
      for (let i = 0; i < quantity; i++) {
        await client.query(
          `INSERT INTO user_merchandise (user_id, convention_id, package_id, store_item_id, item_name, image_url, is_claimed)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
          [userId, conventionId, pkg.package_id, item.store_item_id || null, item.item_name, item.image_url || null]
        );
      }
    }
  }
}

export async function getUserPayments(userId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}
