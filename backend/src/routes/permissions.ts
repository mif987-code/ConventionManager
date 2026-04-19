import { Router, Request, Response } from 'express';
import {
  PERMISSION_CATEGORIES,
  getPermissions,
  setPermissions,
  addPermission,
  removePermission,
  getAllAdmins,
  setAdminStatus,
  hasPermission,
  PermissionCategory,
} from '../services/permissionService';

const router = Router();

// GET /api/permissions/categories — list all permission categories
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: PERMISSION_CATEGORIES });
});

// GET /api/permissions/admins — list all admins with their permissions
router.get('/admins', async (_req: Request, res: Response) => {
  try {
    const admins = await getAllAdmins();
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/permissions/:userId — get permissions for a user
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const permissions = await getPermissions(parseInt(req.params.userId));
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /api/permissions/:userId — set all permissions for a user (requires super)
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { permissions, is_admin } = req.body;
    const targetId = parseInt(req.params.userId);

    if (is_admin !== undefined) {
      const result = await setAdminStatus(targetId, is_admin, permissions || []);
      if (!result) return res.status(404).json({ error: 'User not found' });
      return res.json({ admin: result });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    const updated = await setPermissions(targetId, permissions as PermissionCategory[]);
    res.json({ permissions: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/permissions/:userId/add — add a single permission
router.post('/:userId/add', async (req: Request, res: Response) => {
  try {
    const { permission } = req.body;
    if (!permission) return res.status(400).json({ error: 'permission required' });
    const updated = await addPermission(parseInt(req.params.userId), permission);
    res.json({ permissions: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/permissions/:userId/remove — remove a single permission
router.post('/:userId/remove', async (req: Request, res: Response) => {
  try {
    const { permission } = req.body;
    if (!permission) return res.status(400).json({ error: 'permission required' });
    const updated = await removePermission(parseInt(req.params.userId), permission);
    res.json({ permissions: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/permissions/:userId/promote — make user an admin with specified permissions
router.post('/:userId/promote', async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body;
    const result = await setAdminStatus(parseInt(req.params.userId), true, permissions || []);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json({ admin: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/permissions/:userId/demote — remove admin status
router.post('/:userId/demote', async (req: Request, res: Response) => {
  try {
    const result = await setAdminStatus(parseInt(req.params.userId), false, []);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json({ admin: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
