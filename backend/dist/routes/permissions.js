"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const permissionService_1 = require("../services/permissionService");
const router = (0, express_1.Router)();
// GET /api/permissions/categories — list all permission categories
router.get('/categories', (_req, res) => {
    res.json({ categories: permissionService_1.PERMISSION_CATEGORIES });
});
// GET /api/permissions/admins — list all admins with their permissions
router.get('/admins', async (_req, res) => {
    try {
        const admins = await (0, permissionService_1.getAllAdmins)();
        res.json({ admins });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// GET /api/permissions/:userId — get permissions for a user
router.get('/:userId', async (req, res) => {
    try {
        const permissions = await (0, permissionService_1.getPermissions)(parseInt(req.params.userId));
        res.json({ permissions });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// PUT /api/permissions/:userId — set all permissions for a user (requires super)
router.put('/:userId', async (req, res) => {
    try {
        const { permissions, is_admin } = req.body;
        const targetId = parseInt(req.params.userId);
        if (is_admin !== undefined) {
            const result = await (0, permissionService_1.setAdminStatus)(targetId, is_admin, permissions || []);
            if (!result)
                return res.status(404).json({ error: 'User not found' });
            return res.json({ admin: result });
        }
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'permissions must be an array' });
        }
        const updated = await (0, permissionService_1.setPermissions)(targetId, permissions);
        res.json({ permissions: updated });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/permissions/:userId/add — add a single permission
router.post('/:userId/add', async (req, res) => {
    try {
        const { permission } = req.body;
        if (!permission)
            return res.status(400).json({ error: 'permission required' });
        const updated = await (0, permissionService_1.addPermission)(parseInt(req.params.userId), permission);
        res.json({ permissions: updated });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/permissions/:userId/remove — remove a single permission
router.post('/:userId/remove', async (req, res) => {
    try {
        const { permission } = req.body;
        if (!permission)
            return res.status(400).json({ error: 'permission required' });
        const updated = await (0, permissionService_1.removePermission)(parseInt(req.params.userId), permission);
        res.json({ permissions: updated });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/permissions/:userId/promote — make user an admin with specified permissions
router.post('/:userId/promote', async (req, res) => {
    try {
        const { permissions } = req.body;
        const result = await (0, permissionService_1.setAdminStatus)(parseInt(req.params.userId), true, permissions || []);
        if (!result)
            return res.status(404).json({ error: 'User not found' });
        res.json({ admin: result });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/permissions/:userId/demote — remove admin status
router.post('/:userId/demote', async (req, res) => {
    try {
        const result = await (0, permissionService_1.setAdminStatus)(parseInt(req.params.userId), false, []);
        if (!result)
            return res.status(404).json({ error: 'User not found' });
        res.json({ admin: result });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=permissions.js.map