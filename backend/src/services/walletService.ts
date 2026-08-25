import { pool } from '../config/db';
import { PoolClient } from 'pg';

export type WalletTransactionType = 'deposit' | 'payment' | 'refund' | 'adjustment' | 'prize';

export interface WalletTransaction {
  id: number;
  user_id: number;
  convention_id: number;
  amount_colones: number;
  type: WalletTransactionType;
  reason: string | null;
  event_id: number | null;
  payment_link: string | null;
  created_by: string;
  created_at: Date;
}

interface AddWalletTransactionParams {
  userId: number;
  conventionId: number;
  amountColones: number;
  type: WalletTransactionType;
  reason?: string | null;
  eventId?: number | null;
  paymentLink?: string | null;
  createdBy: string;
  client?: PoolClient;
}

async function addWalletTransaction(params: AddWalletTransactionParams): Promise<WalletTransaction> {
  const { userId, conventionId, amountColones, type, reason, eventId, paymentLink, createdBy, client } = params;
  const executor = client ?? pool;

  const result = await executor.query(
    `INSERT INTO wallet_transactions
       (user_id, convention_id, amount_colones, type, reason, event_id, payment_link, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, conventionId, amountColones, type, reason ?? null, eventId ?? null, paymentLink ?? null, createdBy]
  );

  return result.rows[0];
}

export async function getBalance(userId: number, conventionId: number, client?: PoolClient): Promise<number> {
  const executor = client ?? pool;
  const result = await executor.query(
    `SELECT COALESCE(SUM(amount_colones), 0)::int AS balance
     FROM wallet_transactions
     WHERE user_id = $1 AND convention_id = $2`,
    [userId, conventionId]
  );
  return result.rows[0].balance as number;
}

export async function hasEnoughCredit(
  userId: number,
  conventionId: number,
  amountColones: number,
  client?: PoolClient
): Promise<boolean> {
  const balance = await getBalance(userId, conventionId, client);
  return balance >= amountColones;
}

export async function deposit(
  userId: number,
  conventionId: number,
  amountColones: number,
  createdBy: string,
  paymentLink?: string | null,
  client?: PoolClient
): Promise<WalletTransaction> {
  if (!Number.isInteger(amountColones) || amountColones <= 0) {
    throw new Error('Deposit amount must be a positive number of CRC colones');
  }
  return addWalletTransaction({
    userId,
    conventionId,
    amountColones,
    type: 'deposit',
    reason: 'Wallet top-up',
    paymentLink,
    createdBy,
    client,
  });
}

export async function pay(
  userId: number,
  conventionId: number,
  amountColones: number,
  createdBy: string,
  eventId?: number | null,
  reason?: string,
  client?: PoolClient
): Promise<WalletTransaction> {
  if (!Number.isInteger(amountColones) || amountColones <= 0) {
    throw new Error('Payment amount must be a positive number of CRC colones');
  }
  const balance = await getBalance(userId, conventionId, client);
  if (balance < amountColones) {
    throw new Error('Insufficient credit');
  }
  return addWalletTransaction({
    userId,
    conventionId,
    amountColones: -amountColones,
    type: 'payment',
    reason: reason ?? 'Event payment',
    eventId,
    createdBy,
    client,
  });
}

export async function refund(
  userId: number,
  conventionId: number,
  amountColones: number,
  createdBy: string,
  eventId?: number | null,
  reason?: string,
  client?: PoolClient
): Promise<WalletTransaction> {
  if (!Number.isInteger(amountColones) || amountColones <= 0) {
    throw new Error('Refund amount must be a positive number of CRC colones');
  }
  return addWalletTransaction({
    userId,
    conventionId,
    amountColones,
    type: 'refund',
    reason: reason ?? 'Refund',
    eventId,
    createdBy,
    client,
  });
}

export async function adjust(
  userId: number,
  conventionId: number,
  amountColones: number,
  createdBy: string,
  reason?: string,
  client?: PoolClient
): Promise<WalletTransaction> {
  if (!Number.isInteger(amountColones)) {
    throw new Error('Adjustment amount must be a whole number of CRC colones');
  }
  return addWalletTransaction({
    userId,
    conventionId,
    amountColones,
    type: 'adjustment',
    reason: reason ?? 'Admin adjustment',
    createdBy,
    client,
  });
}

export async function awardPrize(
  userId: number,
  conventionId: number,
  amountColones: number,
  createdBy: string,
  eventId?: number | null,
  reason?: string,
  client?: PoolClient
): Promise<WalletTransaction> {
  if (!Number.isInteger(amountColones) || amountColones <= 0) {
    throw new Error('Prize amount must be a positive number of CRC colones');
  }
  return addWalletTransaction({
    userId,
    conventionId,
    amountColones,
    type: 'prize',
    reason: reason ?? 'Prize',
    eventId,
    createdBy,
    client,
  });
}

export async function getHistory(
  userId: number,
  conventionId: number,
  limit = 50,
  offset = 0
) {
  const result = await pool.query(
    `SELECT w.*, e.name AS event_name
     FROM wallet_transactions w
     LEFT JOIN events e ON w.event_id = e.id
     WHERE w.user_id = $1 AND w.convention_id = $2
     ORDER BY w.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, conventionId, limit, offset]
  );
  return result.rows;
}
