import { pool } from '../config/db';

export interface SpecialVoucher {
  id: number;
  convention_id: number;
  category: string;
  entry_cost: number;
  name: string;
  description: string | null;
  amount: number;
  icon: string;
  color: string;
  max_awards: number;
  awarded_count: number;
  voucher_type: string;
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

// Create a special voucher for an Event Type category + entry cost combo
// (e.g. category='Constructed', entryCost=1 -> matches any Constructed event costing 1 voucher to enter)
export async function createSpecialVoucher(
  conventionId: number,
  category: string,
  entryCost: number,
  name: string,
  amount: number,
  description?: string,
  icon: string = 'star',
  color: string = '#6366f1',
  maxAwards: number = 1,
  voucherType: string = 'static'
): Promise<SpecialVoucher> {
  const result = await pool.query(
    `INSERT INTO special_vouchers (convention_id, category, entry_cost, name, description, amount, icon, color, max_awards, voucher_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [conventionId, category, entryCost, name, description || null, amount, icon, color, maxAwards, voucherType]
  );
  return result.rows[0];
}

// Get all special vouchers that match a specific live event's category + entry cost
export async function getSpecialVouchersMatchingEvent(eventId: number): Promise<SpecialVoucher[]> {
  const eventRes = await pool.query(
    `SELECT e.convention_id, et.category, et.entry_cost_vouchers
     FROM events e
     JOIN event_types et ON e.event_type_id = et.id
     WHERE e.id = $1`,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return [];

  const result = await pool.query(
    `SELECT * FROM special_vouchers
     WHERE convention_id = $1 AND category = $2 AND entry_cost = $3
     ORDER BY created_at DESC`,
    [event.convention_id, event.category, event.entry_cost_vouchers]
  );
  return result.rows;
}

// Get all special vouchers for a convention
export async function getSpecialVouchersByConvention(conventionId: number): Promise<SpecialVoucher[]> {
  const result = await pool.query(
    `SELECT * FROM special_vouchers WHERE convention_id = $1 ORDER BY created_at DESC`,
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
    category?: string;
    entry_cost?: number;
    name?: string;
    description?: string | null;
    amount?: number;
    icon?: string;
    color?: string;
    max_awards?: number;
    voucher_type?: string;
  }
): Promise<SpecialVoucher> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (fields.category !== undefined) { sets.push(`category = $${idx++}`); params.push(fields.category); }
  if (fields.entry_cost !== undefined) { sets.push(`entry_cost = $${idx++}`); params.push(fields.entry_cost); }
  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.description !== undefined) { sets.push(`description = $${idx++}`); params.push(fields.description); }
  if (fields.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(fields.amount); }
  if (fields.icon !== undefined) { sets.push(`icon = $${idx++}`); params.push(fields.icon); }
  if (fields.color !== undefined) { sets.push(`color = $${idx++}`); params.push(fields.color); }
  if (fields.max_awards !== undefined) { sets.push(`max_awards = $${idx++}`); params.push(fields.max_awards); }
  if (fields.voucher_type !== undefined) { sets.push(`voucher_type = $${idx++}`); params.push(fields.voucher_type); }

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

    // Validate the chosen event matches this voucher's category + entry cost
    const eventCheckRes = await client.query(
      `SELECT et.category, et.entry_cost_vouchers
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.id = $1`,
      [eventId]
    );
    const eventInfo = eventCheckRes.rows[0];
    if (!eventInfo) throw new Error('Event not found');
    if (eventInfo.category !== voucher.category || eventInfo.entry_cost_vouchers !== voucher.entry_cost) {
      throw new Error(`This special voucher only applies to ${voucher.category} events costing ${voucher.entry_cost} voucher(s) to enter`);
    }

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

// Award a special voucher as an automatic event prize (called from finishEvent's own
// transaction). Unlike awardSpecialVoucher, this skips the category/entry_cost match
// check since the mapping is explicit (the admin picked this voucher for this prize tier).
// Silently no-ops instead of throwing so a misconfigured/exhausted voucher doesn't abort
// the whole prize distribution.
export async function awardSpecialVoucherAsPrize(
  client: any,
  specialVoucherId: number,
  userId: number,
  eventId: number,
  awardedBy: string = 'admin'
): Promise<SpecialVoucherAward | null> {
  const voucherRes = await client.query(`SELECT * FROM special_vouchers WHERE id = $1 FOR UPDATE`, [specialVoucherId]);
  const voucher = voucherRes.rows[0];
  if (!voucher) return null;

  if (voucher.awarded_count >= voucher.max_awards) return null;

  const existingRes = await client.query(
    `SELECT id FROM special_voucher_awards WHERE special_voucher_id = $1 AND user_id = $2 AND event_id = $3`,
    [specialVoucherId, userId, eventId]
  );
  if (existingRes.rows.length > 0) return null;

  const awardRes = await client.query(
    `INSERT INTO special_voucher_awards (special_voucher_id, user_id, event_id, awarded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [specialVoucherId, userId, eventId, awardedBy]
  );

  await client.query(`UPDATE special_vouchers SET awarded_count = awarded_count + 1 WHERE id = $1`, [specialVoucherId]);

  const { addTransaction } = await import('./transactionService');
  const eventRes = await client.query(`SELECT convention_id FROM events WHERE id = $1`, [eventId]);
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

  return awardRes.rows[0];
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

// Get all special vouchers awarded to a user within a convention (across any event)
export async function getUserSpecialVoucherAwards(userId: number, conventionId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT sva.*, sv.name AS voucher_name, sv.icon, sv.color, sv.amount, sv.category, sv.entry_cost
     FROM special_voucher_awards sva
     JOIN special_vouchers sv ON sva.special_voucher_id = sv.id
     WHERE sva.user_id = $1 AND sv.convention_id = $2
     ORDER BY sva.awarded_at DESC`,
    [userId, conventionId]
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
