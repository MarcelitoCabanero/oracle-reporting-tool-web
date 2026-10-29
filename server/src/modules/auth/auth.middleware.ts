import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AuthUser } from './token.service.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    return;
  }

  req.user = user;
  next();
}
