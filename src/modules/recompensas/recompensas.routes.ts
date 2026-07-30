import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const recompensasRouter = Router();
recompensasRouter.use(requireAuth);

/** GET /recompensas — recompensas activas de la sucursal (para canjear puntos). */
recompensasRouter.get(
  '/',
  ah(async (req, res) => {
    const recompensas = await prisma.recompensa.findMany({
      where: { sucursalId: req.user!.sucursalId, activa: true, deletedAt: null },
      orderBy: { costoPuntos: 'asc' },
    });
    res.json(recompensas);
  }),
);
