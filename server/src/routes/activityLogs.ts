import { Router } from 'express';
import pool from '../db.js';
import { requireSuperAdmin, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/activity-logs — save a super admin action
router.post('/', requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const { action, details } = req.body;

        if (!action) {
            res.status(400).json({ error: 'action is required' });
            return;
        }

        const ip =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            req.ip ||
            'unknown';

        await pool.execute(
            `INSERT INTO super_admin_activity_logs (admin_id, username, action, details, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
            [
                req.user!.id,
                req.user!.username,
                action,
                typeof details === 'string' ? details : JSON.stringify(details ?? ''),
                ip,
            ]
        );

        res.json({ success: true });
    } catch (err: any) {
        console.error('SA activity log insert error:', err);
        res.status(500).json({ error: 'Could not save log' });
    }
});

// GET /api/activity-logs — paginated list of super admin actions
router.get('/', requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
        const perPage = 50;
        const offset = (page - 1) * perPage;

        const [rows] = await pool.execute(
            `SELECT id, admin_id, username, action, details, ip_address, created_at
       FROM super_admin_activity_logs
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
            [perPage, offset]
        );

        const [countRows] = await pool.execute(
            'SELECT COUNT(*) AS total FROM super_admin_activity_logs'
        );

        const total = (countRows as any[])[0]?.total ?? 0;

        res.json({ logs: rows, total, page, perPage });
    } catch (err: any) {
        console.error('SA activity log fetch error:', err);
        res.status(500).json({ error: 'Could not fetch logs' });
    }
});

export default router;
