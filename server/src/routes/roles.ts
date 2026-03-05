import { Router } from 'express';
import pool from '../db.js';
import { requireSuperAdmin, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

const AVAILABLE_ROLES = ['admin', 'lead_manager', 'seo_manager', 'sales_person', 'seo_person', 'client'];

// GET /api/roles - Get available roles
router.get('/', (_req, res) => {
  res.json(AVAILABLE_ROLES);
});

// GET /api/roles/assignments?site_id=X - Get role assignments for a site
router.get('/assignments', async (req, res) => {
  try {
    const { site_id } = req.query;

    let query = 'SELECT id, wp_user_id, site_id, app_role, created_at FROM user_site_assignments';
    const params: any[] = [];

    if (site_id) {
      query += ' WHERE site_id = ?';
      params.push(site_id);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err: any) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roles/assign - Assign a user to a site with a role (super_admin only)
router.put('/assign', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { wp_user_id, site_id, app_role } = req.body;
    if (!wp_user_id || !site_id || !app_role) {
      res.status(400).json({ error: 'wp_user_id, site_id, and app_role are required' });
      return;
    }

    if (!AVAILABLE_ROLES.includes(app_role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${AVAILABLE_ROLES.join(', ')}` });
      return;
    }

    await pool.execute(
      `INSERT INTO user_site_assignments (wp_user_id, site_id, app_role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE app_role = VALUES(app_role)`,
      [wp_user_id, site_id, app_role]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Assign role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/roles/assignments/:id - Remove a role assignment (super_admin only)
router.delete('/assignments/:id', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM user_site_assignments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/roles/user-sites?user_id=X - Get all sites assigned to a user
router.get('/user-sites', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const [rows] = await pool.execute(
      'SELECT id, wp_user_id, site_id, app_role, created_at FROM user_site_assignments WHERE wp_user_id = ?',
      [user_id]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Get user sites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
