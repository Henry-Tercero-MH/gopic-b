import type { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../lib/jwt.js';

/** Exige un JWT válido en Authorization: Bearer <token>. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    req.user = verificarToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Exige que el usuario tenga el rol Administrador. Usar después de requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.roles.includes('Administrador')) {
    return res.status(403).json({ error: 'Requiere permisos de administrador' });
  }
  next();
}
