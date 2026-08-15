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
                json_build_object(
                  'id', sv.id,
                  'name', sv.name,
                  'amount', sv.amount,
                  'description', sv.description,
                  'icon', sv.icon,
                  'color', sv.color
                ) ORDER BY sv.name
              ) FILTER (WHERE sv.id IS NOT NULL),
              '[]'
            ) as special_vouchers
     FROM packages p
     LEFT JOIN package_special_vouchers psv ON psv.package_id = p.id
     LEFT JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
     WHERE p.id = $1
     GROUP BY p.id`,
    [packageId]
  );
  return result.rows[0];
}
