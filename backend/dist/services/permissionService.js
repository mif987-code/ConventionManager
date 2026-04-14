"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_CATEGORIES = void 0;
exports.getPermissions = getPermissions;
exports.setPermissions = setPermissions;
exports.addPermission = addPermission;
exports.removePermission = removePermission;
exports.hasPermission = hasPermission;
exports.getAllAdmins = getAllAdmins;
exports.setAdminStatus = setAdminStatus;
const db_1 = require("../config/db");
// All available permission categories
exports.PERMISSION_CATEGORIES = [
    'super', // Can manage other admins' permissions
    'users', // Can manage users
    'events', // Can manage events (create, start, rounds, matches)
    'vouchers', // Can manage voucher top-ups
    'tix', // Can manage tix adjustments
    'store', // Can manage store items & orders
    'stats', // Can view statistics
    'register', // Can register players at events via NFC
];
async function getPermissions(userId) {
    const result = await db_1.pool.query(`SELECT admin_permissions FROM users WHERE id = $1`, [userId]);
    if (!result.rows[0])
        return [];
    return result.rows[0].admin_permissions || [];
}
async function setPermissions(userId, permissions) {
    // Validate all permissions
    const valid = permissions.filter(p => exports.PERMISSION_CATEGORIES.includes(p));
    const result = await db_1.pool.query(`UPDATE users SET admin_permissions = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING admin_permissions`, [JSON.stringify(valid), userId]);
    return result.rows[0]?.admin_permissions || [];
}
async function addPermission(userId, permission) {
    if (!exports.PERMISSION_CATEGORIES.includes(permission)) {
        throw new Error(`Invalid permission: ${permission}`);
    }
    const current = await getPermissions(userId);
    if (current.includes(permission))
        return current;
    const updated = [...current, permission];
    return setPermissions(userId, updated);
}
async function removePermission(userId, permission) {
    const current = await getPermissions(userId);
    const updated = current.filter(p => p !== permission);
    return setPermissions(userId, updated);
}
async function hasPermission(userId, permission) {
    const perms = await getPermissions(userId);
    // Super admins have all permissions
    if (perms.includes('super'))
        return true;
    return perms.includes(permission);
}
async function getAllAdmins() {
    const result = await db_1.pool.query(`SELECT id, name, last_name, email, is_admin, admin_permissions
     FROM users WHERE is_admin = true ORDER BY name`);
    return result.rows;
}
async function setAdminStatus(userId, isAdmin, permissions = []) {
    const valid = permissions.filter(p => exports.PERMISSION_CATEGORIES.includes(p));
    const result = await db_1.pool.query(`UPDATE users SET is_admin = $1, admin_permissions = $2::jsonb, updated_at = NOW()
     WHERE id = $3 RETURNING id, name, last_name, email, is_admin, admin_permissions`, [isAdmin, JSON.stringify(valid), userId]);
    return result.rows[0] || null;
}
//# sourceMappingURL=permissionService.js.map