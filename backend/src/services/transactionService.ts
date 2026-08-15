import { pool } from '../config/db';
import { PoolClient } from 'pg';

export type TransactionType = 'voucher' | 'tix';
export type TransactionReason =
  | 'topup'
  | 'event_entry'
  | 'prize'
  | 'refund'
  | 'admin_adjust'
  | 'purchase'
  | 'special_voucher'
  | 'special_voucher_refund';

interface AddTransactionParams {
  userId: number;
  type: TransactionType;
  amount: number;
  reason: TransactionReason;
  eventId?: number | null;
  createdBy: string;
  client?: PoolClient;
  conventionId?: number;
  paymentLink?: string | null;
}

// All balance changes go through this single ledger insert.
export async function addTransaction(params: AddTransactionParams): Promise<number> {
  const { userId, type, amount, reason, eventId, createdBy, client, conventionId, paymentLink } = params;
  const executor = client ?? pool;

  const result = await executor.query(
    `INSERT INTO transactions (user_id, type, amount, reason, event_id, created_by, convention_id, payment_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [userId, type, amount, reason, eventId ?? null, createdBy, conventionId ?? null, paymentLink ?? null]
  );

  return result.rows[0].id as number;
}

// Balance is always computed from the ledger — never stored.
export async function getBalance(
  userId: number,
  type: TransactionType,
  client?: PoolClient,
  conventionId?: number
): Promise<number> {
  const executor = client ?? pool;

  const query = conventionId
    ? `SELECT COALESCE(SUM(amount), 0)::numeric AS balance FROM transactions WHERE user_id = $1 AND type = $2 AND convention_id = $3`
    : `SELECT COALESCE(SUM(amount), 0)::numeric AS balance FROM transactions WHERE user_id = $1 AND type = $2`;

  const params: (number | string)[] = conventionId
    ? [userId, type, conventionId]
    : [userId, type];

  const result = await executor.query(query, params);
  return result.rows[0].balance as number;
}

export async function getTransactionHistory(
  userId: number,
  type?: TransactionType,
  limit = 50,
  offset = 0
) {
  const params: (number | string)[] = [userId];
  let query = `SELECT t.*, e.name AS event_name
               FROM transactions t
               LEFT JOIN events e ON t.event_id = e.id
               WHERE t.user_id = $1`;

  if (type) {
    query += ` AND t.type = $2`;
    params.push(type);
  }

  query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}
