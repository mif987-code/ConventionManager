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
  regular_voucher_amount: number;
  package_type: PackageType;
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
  regularVoucherAmount: number = 0,
  packageType: PackageType = 'day_pass'
): Promise<Package> {
  const result = await pool.query(
    `INSERT INTO packages (convention_id, name, description, days, cost, prereg_cost, regular_voucher_amount, package_type, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     RETURNING *`,
    [conventionId, name, description, days, cost, preregCost, regularVoucherAmount, packageType]
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
  regularVoucherAmount: number,
  is_active: boolean,
  packageType: PackageType = 'day_pass'
): Promise<Package> {
  const result = await pool.query(
    `UPDATE packages SET name = $2, description = $3, days = $4, cost = $5, prereg_cost = $6, regular_voucher_amount = $7, is_active = $8, package_type = $9
     WHERE id = $1 RETURNING *`,
    [id, name, description, days, cost, preregCost, regularVoucherAmount, is_active, packageType]
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

export async function getMerchandiseForPackage(packageId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM package_merchandise WHERE package_id = $1 ORDER BY id ASC`,
    [packageId]
  );
  return result.rows;
}

export async function setPackageMerchandise(packageId: number, itemNames: string[]): Promise<void> {
  await pool.query('DELETE FROM package_merchandise WHERE package_id = $1', [packageId]);
  for (const name of itemNames) {
    if (name && name.trim()) {
      await pool.query(
        'INSERT INTO package_merchandise (package_id, item_name) VALUES ($1, $2)',
        [packageId, name.trim()]
      );
    }
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
  const items = await getMerchandiseForPackage(packageId);
  for (const item of items) {
    for (let i = 0; i < quantity; i++) {
      await pool.query(
        `INSERT INTO user_merchandise (user_id, convention_id, package_id, item_name, is_claimed)
         VALUES ($1, $2, $3, $4, FALSE)`,
        [userId, conventionId, packageId, item.item_name]
      );
    }
  }
}
