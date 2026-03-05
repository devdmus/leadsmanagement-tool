import { Router } from 'express';
import pool from '../db.js';
import { requireSuperAdmin, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/permissions - Get full permission matrix (no auth required)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, role, feature, can_read, can_write FROM role_permissions ORDER BY role, feature'
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Get permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/permissions - Update single permission (super_admin only)
router.put('/', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { role, feature, can_read, can_write } = req.body;
    if (!role || !feature) {
      res.status(400).json({ error: 'Role and feature are required' });
      return;
    }

    await pool.execute(
      `INSERT INTO role_permissions (role, feature, can_read, can_write)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE can_read = VALUES(can_read), can_write = VALUES(can_write), updated_at = CURRENT_TIMESTAMP`,
      [role, feature, can_read ?? false, can_write ?? false]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update permission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/permissions/bulk - Bulk update permissions (super_admin only)
router.post('/bulk', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      res.status(400).json({ error: 'Permissions array is required' });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const perm of permissions) {
        await conn.execute(
          `INSERT INTO role_permissions (role, feature, can_read, can_write)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE can_read = VALUES(can_read), can_write = VALUES(can_write), updated_at = CURRENT_TIMESTAMP`,
          [perm.role, perm.feature, perm.can_read ?? false, perm.can_write ?? false]
        );
      }

      await conn.commit();
      res.json({ success: true, updated: permissions.length });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('Bulk update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
