import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Envuelve handlers async para que sus errores lleguen al manejador central. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
