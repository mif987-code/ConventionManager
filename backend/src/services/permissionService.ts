import { pool } from '../config/db';

// All available permission categories
export const PERMISSION_CATEGORIES = [
  'super',      // Can manage other admins' permissions
  'users',      // Can manage users
  'events',     // Can manage events (create, start, rounds, matches)
  'vouchers',   // Can manage voucher top-ups
  'tix',        // Can manage tix adjustments
  'store',      // Can manage store items & orders
  'stats',      // Can view statistics
  'register',   // Can register players at events via NFC
] as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];

export async function getPermissions(userId: number): Promise<PermissionCategory[]> {
  const result = await pool.query(
    `SELECT admin_permissions FROM users WHERE id = $1`,
    [userId]
  );
  if (!result.rows[0]) return [];
  return result.rows[0].admin_permissions || [];
}

export async function setPermissions(userId: number, permissions: PermissionCategory[]): Promise<PermissionCategory[]> {
  // Validate all permissions
  const valid = permissions.filter(p => PERMISSION_CATEGORIES.includes(p));
  const result = await pool.query(
    `UPDATE users SET admin_permissions = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING admin_permissions`,
    [JSON.stringify(valid), userId]
  );
  return result.rows[0]?.admin_permissions || [];
}

export async function addPermission(userId: number, permission: PermissionCategory): Promise<PermissionCategory[]> {
  if (!PERMISSION_CATEGORIES.includes(permission)) {
    throw new Error(`Invalid permission: ${permission}`);
  }
  const current = await getPermissions(userId);
  if (current.includes(permission)) return current;
  const updated = [...current, permission];
  return setPermissions(userId, updated);
}

export async function removePermission(userId: number, permission: PermissionCategory): Promise<PermissionCategory[]> {
  const current = await getPermissions(userId);
  const updated = current.filter(p => p !== permission);
  return setPermissions(userId, updated);
}

export async function hasPermission(userId: number, permission: PermissionCategory): Promise<boolean> {
  const perms = await getPermissions(userId);
  // Super admins have all permissions
  if (perms.includes('super')) return true;
  return perms.includes(permission);
}

export async function getAllAdmins() {
  const result = await pool.query(
    `SELECT id, name, last_name, email, is_admin, admin_permissions
     FROM users WHERE is_admin = true ORDER BY name`
  );
  return result.rows;
}

export async function setAdminStatus(userId: number, isAdmin: boolean, permissions: PermissionCategory[] = []) {
  const valid = permissions.filter(p => PERMISSION_CATEGORIES.includes(p));
  const result = await pool.query(
    `UPDATE users SET is_admin = $1, admin_permissions = $2::jsonb, updated_at = NOW()
     WHERE id = $3 RETURNING id, name, last_name, email, is_admin, admin_permissions`,
    [isAdmin, JSON.stringify(valid), userId]
  );
  return result.rows[0] || null;
}
