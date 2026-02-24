import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { signToken } from '../utils/jwt.js';
import { requireSuperAdmin, AuthRequest } from '../middleware/authMiddleware.js';
import { createSession, invalidateSession, validateSession } from '../utils/session.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const [rows] = await pool.execute(
      'SELECT id, username, email, password_hash FROM super_admins WHERE username = ?',
      [username]
    );

    const users = rows as any[];
    if (users.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ id: user.id, username: user.username });

    // Create session (invalidates any previous active sessions for this user)
    await createSession({
      userId: user.id,
      userType: 'super_admin',
      token,
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h, matching JWT expiry
    });

    res.json({
      token,
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'super_admin',
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email FROM super_admins WHERE id = ?',
      [req.user!.id]
    );

    const users = rows as any[];
    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = users[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'super_admin',
    });
  } catch (err: any) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const token = req.headers.authorization!.slice(7); // Remove 'Bearer '
    await invalidateSession(token);
    res.json({ message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/session-valid
router.get('/session-valid', requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const token = req.headers.authorization!.slice(7);
    const isValid = await validateSession(token);
    if (!isValid) {
      res.status(401).json({ error: 'Session invalidated', code: 'SESSION_INVALIDATED' });
      return;
    }
    res.json({ valid: true });
  } catch (err: any) {
    console.error('Session check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
