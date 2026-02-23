import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/sites — list all sites
router.get('/', async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM wp_sites ORDER BY created_at ASC');
        // Parse assignedAdmins JSON field
        const sites = (rows as any[]).map(row => ({
            ...row,
            assignedAdmins: row.assigned_admins ? JSON.parse(row.assigned_admins) : [],
        }));
        res.json(sites);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sites — create a new site
router.post('/', async (req: Request, res: Response) => {
    try {
        const { id, name, url, username, appPassword, isDefault, assignedAdmins } = req.body;
        await pool.execute(
            `INSERT INTO wp_sites (id, name, url, username, app_password, is_default, assigned_admins)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                url,
                username || null,
                appPassword || null,
                isDefault ? 1 : 0,
                JSON.stringify(assignedAdmins || []),
            ]
        );
        const [rows] = await pool.execute('SELECT * FROM wp_sites WHERE id = ?', [id]);
        const site = (rows as any[])[0];
        res.status(201).json({
            ...site,
            assignedAdmins: site.assigned_admins ? JSON.parse(site.assigned_admins) : [],
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/sites/:id — update a site
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, url, username, appPassword, isDefault, assignedAdmins } = req.body;
        await pool.execute(
            `UPDATE wp_sites SET
         name = COALESCE(?, name),
         url = COALESCE(?, url),
         username = ?,
         app_password = ?,
         is_default = COALESCE(?, is_default),
         assigned_admins = COALESCE(?, assigned_admins)
       WHERE id = ?`,
            [
                name ?? null,
                url ?? null,
                username ?? null,
                appPassword ?? null,
                isDefault !== undefined ? (isDefault ? 1 : 0) : null,
                assignedAdmins !== undefined ? JSON.stringify(assignedAdmins) : null,
                id,
            ]
        );
        const [rows] = await pool.execute('SELECT * FROM wp_sites WHERE id = ?', [id]);
        const site = (rows as any[])[0];
        if (!site) return res.status(404).json({ error: 'Site not found' });
        res.json({
            ...site,
            assignedAdmins: site.assigned_admins ? JSON.parse(site.assigned_admins) : [],
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/sites/:id — delete a site
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM wp_sites WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
