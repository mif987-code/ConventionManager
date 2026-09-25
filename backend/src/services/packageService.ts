import { pool } from '../config/db';

export type PackageType = 'day_pass' | 'voucher_pack' | 'merchandise';

export interface Package {
  id: number;
  convention_id: number;
  name: string;
  description: string | null;
  days: number;
  cost: number;
  prereg_cost: number | null;
  prereg_start_date: string | null;
  prereg_end_date: string | null;
  regular_voucher_amount: number;
  package_type: PackageType;
  max_age: number | null;
  is_active: boolean;
  created_at: Date;
}

export async function getPackagesByConvention(conventionId: number): Promise<Package[]> {
  const result = await pool.query(
    `SELECT * FROM packages WHERE convention_id = $1 AND is_active = TRUE ORDER BY days ASC, cost ASC`,
    [conventionId]
  );
  return result.rows;
}

export async function createPackage(
  conventionId: number,
  name: string,
  description: string | null,
  days: number,
  cost: number,
  preregCost: number | null = null,
  preregStartDate: string | null = null,
  preregEndDate: string | null = null,
  regularVoucherAmount: number = 0,
  packageType: PackageType = 'day_pass',
  maxAge: number | null = null
): Promise<Package> {
  const result = await pool.query(
    `INSERT INTO packages (convention_id, name, description, days, cost, prereg_cost, prereg_start_date, prereg_end_date, regular_voucher_amount, package_type, max_age, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
     RETURNING *`,
    [conventionId, name, description, days, cost, preregCost, preregStartDate, preregEndDate, regularVoucherAmount, packageType, maxAge]
  );
  return result.rows[0];
}

export async function updatePackage(
  id: number,
  name: string,
  description: string | null,
  days: number,
  cost: number,
  preregCost: number | null,
  preregStartDate: string | null,
  preregEndDate: string | null,
  regularVoucherAmount: number,
  is_active: boolean,
  packageType: PackageType = 'day_pass',
  maxAge: number | null = null
): Promise<Package> {
  const result = await pool.query(
    `UPDATE packages SET name = $2, description = $3, days = $4, cost = $5, prereg_cost = $6, prereg_start_date = $7, prereg_end_date = $8, regular_voucher_amount = $9, is_active = $10, package_type = $11, max_age = $12
     WHERE id = $1 RETURNING *`,
    [id, name, description, days, cost, preregCost, preregStartDate, preregEndDate, regularVoucherAmount, is_active, packageType, maxAge]
  );
  return result.rows[0];
}

export async function deletePackage(id: number): Promise<void> {
  await pool.query('DELETE FROM packages WHERE id = $1', [id]);
}

export async function getSpecialVouchersForPackage(packageId: number): Promise<number[]> {
  const result = await pool.query(
    `SELECT special_voucher_id FROM package_special_vouchers WHERE package_id = $1`,
    [packageId]
  );
  return result.rows.map(row => row.special_voucher_id);
}

export async function addSpecialVoucherToPackage(packageId: number, specialVoucherId: number): Promise<void> {
  await pool.query(
    `INSERT INTO package_special_vouchers (package_id, special_voucher_id)
     VALUES ($1, $2)
     ON CONFLICT (package_id, special_voucher_id) DO NOTHING`,
    [packageId, specialVoucherId]
  );
}

export async function removeSpecialVoucherFromPackage(packageId: number, specialVoucherId: number): Promise<void> {
  await pool.query(
    `DELETE FROM package_special_vouchers WHERE package_id = $1 AND special_voucher_id = $2`,
    [packageId, specialVoucherId]
  );
}

export async function getPackageWithVouchers(packageId: number): Promise<any> {
  const result = await pool.query(
    `SELECT p.*, 
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', sv.id,
                  'name', sv.name,
                  'amount', sv.amount,
                  'description', sv.description,
                  'icon', sv.icon,
                  'color', sv.color
                )
              ) FILTER (WHERE sv.id IS NOT NULL),
              '[]'
            ) as special_vouchers,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', pm.id,
                  'item_name', pm.item_name
                )
              ) FILTER (WHERE pm.id IS NOT NULL),
              '[]'
            ) as merchandise_items
     FROM packages p
     LEFT JOIN package_special_vouchers psv ON psv.package_id = p.id
     LEFT JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
     LEFT JOIN package_merchandise pm ON pm.package_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [packageId]
  );
  return result.rows[0];
}

export async function validatePackageMerchandiseStock(packageId: number, quantity: number = 1): Promise<void> {
  const result = await pool.query(
    `SELECT pm.item_name, si.stock
     FROM package_merchandise pm
     JOIN store_items si ON si.id = pm.store_item_id
     WHERE pm.package_id = $1 AND si.stock < $2`,
    [packageId, quantity]
  );
  if (result.rows.length > 0) {
    const unavailable = result.rows.map(item => `${item.item_name} (${item.stock} available)`).join(', ');
    throw Object.assign(new Error(`Not enough merchandise stock: ${unavailable}`), { status: 409 });
  }
}

export async function getMerchandiseForPackage(packageId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT pm.*, si.stock, si.price_tix, si.active AS store_active
     FROM package_merchandise pm
     LEFT JOIN store_items si ON si.id = pm.store_item_id
     WHERE pm.package_id = $1 ORDER BY pm.id ASC`,
    [packageId]
  );
  return result.rows;
}

export async function setPackageMerchandise(
  packageId: number,
  items: Array<{ item_name: string; image_url?: string | null; store_item_id?: number | null; stock?: number; price_tix?: number } | string>
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const packageResult = await client.query('SELECT convention_id, name FROM packages WHERE id = $1', [packageId]);
    if (packageResult.rows.length === 0) throw new Error('Package not found');
    const pkg = packageResult.rows[0];
    const existing = await client.query('SELECT store_item_id FROM package_merchandise WHERE package_id = $1', [packageId]);
    const retainedStoreIds: number[] = [];

    await client.query('DELETE FROM package_merchandise WHERE package_id = $1', [packageId]);
    for (const item of items) {
      const name = typeof item === 'string' ? item : item?.item_name;
      const imageUrl = typeof item === 'string' ? null : (item?.image_url || null);
      if (!name?.trim()) continue;

      let storeItemId = typeof item === 'string' ? null : (item.store_item_id || null);
      const stock = typeof item === 'string' ? 0 : Math.max(0, Number(item.stock) || 0);
      const priceTix = typeof item === 'string' ? 0 : Math.max(0, Number(item.price_tix) || 0);
      if (storeItemId) {
        const updated = await client.query(
          `UPDATE store_items SET name = $2, description = $3, price_tix = $4, stock = $5, image_url = $6, active = TRUE, updated_at = NOW()
           WHERE id = $1 RETURNING id`,
          [storeItemId, name.trim(), `Package merchandise from ${pkg.name}`, priceTix, stock, imageUrl]
        );
        if (updated.rows.length === 0) storeItemId = null;
      }
      if (!storeItemId) {
        const created = await client.query(
          `INSERT INTO store_items (name, description, price_tix, stock, image_url, active, convention_id, language, condition, foil, cost, package_managed)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6, 'N/A', 'N/A', FALSE, 0, TRUE) RETURNING id`,
          [name.trim(), `Package merchandise from ${pkg.name}`, priceTix, stock, imageUrl, pkg.convention_id]
        );
        storeItemId = created.rows[0].id;
      }
      if (!storeItemId) throw new Error('Failed to create linked store item');
      retainedStoreIds.push(storeItemId);
      await client.query(
        'INSERT INTO package_merchandise (package_id, item_name, image_url, store_item_id) VALUES ($1, $2, $3, $4)',
        [packageId, name.trim(), imageUrl, storeItemId]
      );
    }

    const removedStoreIds = existing.rows.map(row => row.store_item_id).filter((id: number | null) => id && !retainedStoreIds.includes(id));
    if (removedStoreIds.length > 0) {
      await client.query(
        `UPDATE store_items si SET active = FALSE, updated_at = NOW()
         WHERE si.id = ANY($1::int[]) AND si.package_managed = TRUE
           AND NOT EXISTS (SELECT 1 FROM package_merchandise pm WHERE pm.store_item_id = si.id)`,
        [removedStoreIds]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserMerchandise(userId: number, conventionId?: number): Promise<any[]> {
  const query = conventionId
    ? `SELECT um.*, p.name as package_name FROM user_merchandise um LEFT JOIN packages p ON p.id = um.package_id WHERE um.user_id = $1 AND um.convention_id = $2 ORDER BY um.id ASC`
    : `SELECT um.*, p.name as package_name FROM user_merchandise um LEFT JOIN packages p ON p.id = um.package_id WHERE um.user_id = $1 ORDER BY um.id ASC`;
  const params = conventionId ? [userId, conventionId] : [userId];
  const result = await pool.query(query, params);
  return result.rows;
}

export async function claimUserMerchandise(id: number, claimedBy: string = 'admin'): Promise<any> {
  const result = await pool.query(
    `UPDATE user_merchandise SET is_claimed = TRUE, claimed_at = NOW(), claimed_by = $1 WHERE id = $2 RETURNING *`,
    [claimedBy, id]
  );
  return result.rows[0];
}

export async function unclaimUserMerchandise(id: number): Promise<any> {
  const result = await pool.query(
    `UPDATE user_merchandise SET is_claimed = FALSE, claimed_at = NULL, claimed_by = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}

export async function awardPackageMerchandiseToUser(userId: number, conventionId: number, packageId: number, quantity: number = 1): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM package_merchandise WHERE package_id = $1 ORDER BY id', [packageId]);
    for (const item of result.rows) {
      if (item.store_item_id) {
        await client.query('UPDATE store_items SET stock = stock - $2, updated_at = NOW() WHERE id = $1', [item.store_item_id, quantity]);
      }
      for (let i = 0; i < quantity; i++) {
        await client.query(
          `INSERT INTO user_merchandise (user_id, convention_id, package_id, store_item_id, item_name, image_url, is_claimed)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
          [userId, conventionId, packageId, item.store_item_id || null, item.item_name, item.image_url || null]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
