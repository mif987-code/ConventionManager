import { pool } from '../config/db';
import { addTransaction } from './transactionService';

export interface PaymentIntent {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  paymentUrl?: string;
  paymentLink?: string;
  amount: number;
}

// Mock payment provider - replace with real provider (Stripe, PayPal, etc.)
export async function createPayment(amount: number): Promise<PaymentIntent> {
  // TODO: Replace with actual payment provider integration
  // For now, return a mock payment intent
  const paymentId = 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  return {
    id: paymentId,
    status: 'pending',
    paymentUrl: `https://payment-mock.com/pay/${paymentId}`,
    paymentLink: `https://payment-mock.com/transaction/${paymentId}`,
    amount,
  };
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
  const payment = await getPayment(paymentId);

  if (!payment) {
    throw new Error('Payment not found');
  }

  // Prevent double processing
  if (payment.status === 'paid') {
    return;
  }

  if (status === 'paid') {
    // Update payment status
    await updatePaymentStatus(paymentId, 'paid');

    // Check if user has a package selected
    const packageRes = await pool.query(
      `SELECT up.package_id, p.regular_voucher_amount, p.prereg_cost, p.cost
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = $1`,
      [payment.user_id]
    );

    if (packageRes.rows.length > 0) {
      const pkg = packageRes.rows[0];
      const packageCost = pkg.prereg_cost || pkg.cost;

      // If payment matches package cost, award package vouchers
      if (payment.amount === packageCost && pkg.regular_voucher_amount > 0) {
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
