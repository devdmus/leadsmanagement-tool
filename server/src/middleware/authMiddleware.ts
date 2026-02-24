import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
