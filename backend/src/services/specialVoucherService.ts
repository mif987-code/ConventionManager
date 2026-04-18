import { pool } from '../config/db';

export interface SpecialVoucher {
  id: number;
  event_id: number;
  name: string;
  description: string | null;
  amount: number;
  icon: string;
  color: string;
  max_awards: number;
  awarded_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface SpecialVoucherAward {
  id: number;
  special_voucher_id: number;
  user_id: number;
  event_id: number;
  awarded_by: string;
  awarded_at: Date;
}

// Create a special voucher for an event
export async function createSpecialVoucher(
  eventId: number,
  name: string,
  amount: number,
  description?: string,
  icon: string = 'star',
  color: string = '#6366f1',
  maxAwards: number = 1
): Promise<SpecialVoucher> {
  const result = await pool.query(
    `INSERT INTO special_vouchers (event_id, name, description, amount, icon, color, max_awards)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [eventId, name, description || null, amount, icon, color, maxAwards]
  );
  return result.rows[0];
}

// Get all special vouchers for an event
export async function getSpecialVouchersByEvent(eventId: number): Promise<SpecialVoucher[]> {
  const result = await pool.query(
    `SELECT * FROM special_vouchers WHERE event_id = $1 ORDER BY created_at DESC`,
    [eventId]
  );
  return result.rows;
}

// Get all special vouchers for a convention
export async function getSpecialVouchersByConvention(conventionId: number): Promise<SpecialVoucher[]> {
  const result = await pool.query(
    `SELECT sv.*, e.name as event_name 
     FROM special_vouchers sv
     JOIN events e ON sv.event_id = e.id
     WHERE e.convention_id = $1
     ORDER BY sv.created_at DESC`,
    [conventionId]
  );
  return result.rows;
}

// Get a special voucher by ID
export async function getSpecialVoucherById(id: number): Promise<SpecialVoucher | null> {
  const result = await pool.query(
    `SELECT * FROM special_vouchers WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// Update a special voucher
export async function updateSpecialVoucher(
  id: number,
  fields: {
    name?: string;
    description?: string | null;
    amount?: number;
    icon?: string;
    color?: string;
    max_awards?: number;
  }
): Promise<SpecialVoucher> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.description !== undefined) { sets.push(`description = $${idx++}`); params.push(fields.description); }
  if (fields.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(fields.amount); }
  if (fields.icon !== undefined) { sets.push(`icon = $${idx++}`); params.push(fields.icon); }
  if (fields.color !== undefined) { sets.push(`color = $${idx++}`); params.push(fields.color); }
  if (fields.max_awards !== undefined) { sets.push(`max_awards = $${idx++}`); params.push(fields.max_awards); }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const result = await pool.query(
    `UPDATE special_vouchers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new Error('Special voucher not found');
  return result.rows[0];
}

// Delete a special voucher
export async function deleteSpecialVoucher(id: number): Promise<void> {
  const result = await pool.query(
    `DELETE FROM special_vouchers WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rows.length === 0) throw new Error('Special voucher not found');
}

// Award a special voucher to a user
export async function awardSpecialVoucher(
  specialVoucherId: number,
  userId: number,
  eventId: number,
  awardedBy: string = 'admin'
): Promise<SpecialVoucherAward> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the special voucher
    const voucherRes = await client.query(
      `SELECT * FROM special_vouchers WHERE id = $1 FOR UPDATE`,
      [specialVoucherId]
    );
    const voucher = voucherRes.rows[0];
    if (!voucher) throw new Error('Special voucher not found');

    // Check if max awards reached
    if (voucher.awarded_count >= voucher.max_awards) {
      throw new Error('Maximum awards reached for this special voucher');
    }

    // Check if user already received this voucher
    const existingRes = await client.query(
      `SELECT id FROM special_voucher_awards 
       WHERE special_voucher_id = $1 AND user_id = $2 AND event_id = $3`,
      [specialVoucherId, userId, eventId]
    );
    if (existingRes.rows.length > 0) {
      throw new Error('User already received this special voucher');
    }

    // Create the award record
    const awardRes = await client.query(
      `INSERT INTO special_voucher_awards (special_voucher_id, user_id, event_id, awarded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [specialVoucherId, userId, eventId, awardedBy]
    );

    // Update awarded count
    await client.query(
      `UPDATE special_vouchers SET awarded_count = awarded_count + 1 WHERE id = $1`,
      [specialVoucherId]
    );

    // Award the actual vouchers to the user
    const { addTransaction } = await import('./transactionService');
    
    // Fetch convention_id from event
    const eventRes = await client.query(
      `SELECT convention_id FROM events WHERE id = $1`,
      [eventId]
    );
    const eventConventionId = eventRes.rows[0]?.convention_id;
    
    await addTransaction({
      userId,
      type: 'voucher',
      amount: voucher.amount,
      reason: 'special_voucher',
      eventId,
      createdBy: awardedBy,
      conventionId: eventConventionId,
      client,
    });

    await client.query('COMMIT');
    return awardRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Get awards for a special voucher
export async function getSpecialVoucherAwards(specialVoucherId: number): Promise<SpecialVoucherAward[]> {
  const result = await pool.query(
    `SELECT sva.*, u.name AS user_name, u.nfc_uid
     FROM special_voucher_awards sva
     JOIN users u ON sva.user_id = u.id
     WHERE sva.special_voucher_id = $1
     ORDER BY sva.awarded_at DESC`,
    [specialVoucherId]
  );
  return result.rows;
}

// Get special vouchers awarded to a user in an event
export async function getUserSpecialVouchersForEvent(userId: number, eventId: number): Promise<SpecialVoucherAward[]> {
  const result = await pool.query(
    `SELECT sva.*, sv.name AS voucher_name, sv.icon, sv.color, sv.amount
     FROM special_voucher_awards sva
     JOIN special_vouchers sv ON sva.special_voucher_id = sv.id
     WHERE sva.user_id = $1 AND sva.event_id = $2
     ORDER BY sva.awarded_at DESC`,
    [userId, eventId]
  );
  return result.rows;
}

// Delete an award (admin only)
export async function deleteSpecialVoucherAward(awardId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the award
    const awardRes = await client.query(
      `SELECT * FROM special_voucher_awards WHERE id = $1 FOR UPDATE`,
      [awardId]
    );
    const award = awardRes.rows[0];
    if (!award) throw new Error('Award not found');

    // Get the voucher to know the amount to refund
    const voucherRes = await client.query(
      `SELECT * FROM special_vouchers WHERE id = $1`,
      [award.special_voucher_id]
    );
    const voucher = voucherRes.rows[0];
    if (!voucher) throw new Error('Special voucher not found');

    // Refund the vouchers
    const { addTransaction } = await import('./transactionService');
    
    // Fetch convention_id from event
    const eventRes = await client.query(
      `SELECT convention_id FROM events WHERE id = $1`,
      [award.event_id]
    );
    const eventConventionId = eventRes.rows[0]?.convention_id;
    
    await addTransaction({
      userId: award.user_id,
      type: 'voucher',
      amount: -voucher.amount,
      reason: 'special_voucher_refund',
      eventId: award.event_id,
      createdBy: 'admin',
      conventionId: eventConventionId,
      client,
    });

    // Delete the award
    await client.query(
      `DELETE FROM special_voucher_awards WHERE id = $1`,
      [awardId]
    );

    // Update awarded count
    await client.query(
      `UPDATE special_vouchers SET awarded_count = awarded_count - 1 WHERE id = $1`,
      [award.special_voucher_id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
