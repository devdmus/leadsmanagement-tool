import crypto from 'crypto';
import pool from '../db.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(params: {
  userId: number;
  userType: 'super_admin' | 'wp_user';
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}): Promise<number> {
  const tokenHash = hashToken(params.token);

  // Invalidate all existing active sessions for this user (single-session enforcement)
  await pool.execute(
    `UPDATE sessions SET is_active = FALSE, invalidated_at = NOW()
     WHERE user_id = ? AND user_type = ? AND is_active = TRUE`,
    [params.userId, params.userType]
  );

  // Create new session
  const [result] = await pool.execute(
    `INSERT INTO sessions (user_id, user_type, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.userId,
      params.userType,
      tokenHash,
      params.ipAddress || null,
      params.userAgent || null,
      params.expiresAt,
    ]
  );

  return (result as any).insertId;
}

export async function validateSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const [rows] = await pool.execute(
    `SELECT id FROM sessions
     WHERE token_hash = ? AND is_active = TRUE AND expires_at > NOW()`,
    [tokenHash]
  );
  return (rows as any[]).length > 0;
}

export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.execute(
    `UPDATE sessions SET is_active = FALSE, invalidated_at = NOW()
     WHERE token_hash = ?`,
    [tokenHash]
  );
}

export async function invalidateAllUserSessions(
  userId: number,
  userType: 'super_admin' | 'wp_user'
): Promise<void> {
  await pool.execute(
    `UPDATE sessions SET is_active = FALSE, invalidated_at = NOW()
     WHERE user_id = ? AND user_type = ? AND is_active = TRUE`,
    [userId, userType]
  );
}
