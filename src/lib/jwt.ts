import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export interface TokenPayload {
  /** id del usuario (staff). */
  sub: string;
  sucursalId: string;
  roles: string[];
}

export function firmarToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES } as SignOptions);
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
