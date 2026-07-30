import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Hash de contraseña con scrypt (sin dependencias). Formato: scrypt$salt$hash.
// Mismo esquema que usa prisma/seed.ts.

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw: string, almacenado: string): boolean {
  const [scheme, salt, hash] = almacenado.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = scryptSync(pw, salt, 64);
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}
