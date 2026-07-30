import type { TokenPayload } from '../lib/jwt.js';

// Extiende Express.Request con el usuario autenticado (lo pone requireAuth).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
