import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { validateSession } from '../utils/session.js';

export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

export async function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    // Validate session is still active in DB
    const sessionValid = await validateSession(token);
    if (!sessionValid) {
      res.status(401).json({ error: 'Session has been invalidated', code: 'SESSION_INVALIDATED' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
