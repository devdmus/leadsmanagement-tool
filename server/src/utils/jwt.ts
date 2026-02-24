import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'crm_super_admin_secret_key_2024';

export function signToken(payload: { id: number; username: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { id: number; username: string } {
  return jwt.verify(token, SECRET) as { id: number; username: string };
}
