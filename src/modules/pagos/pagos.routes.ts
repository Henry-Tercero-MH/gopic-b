import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const pagosRouter = Router();
pagosRouter.use(requireAuth);

/** GET /formas-pago — catálogo de formas de pago (Efectivo, Tarjeta, …). */
pagosRouter.get(
  '/',
  ah(async (_req, res) => {
    const formas = await prisma.formaPago.findMany({ orderBy: { nombre: 'asc' } });
    res.json(formas);
  }),
);
