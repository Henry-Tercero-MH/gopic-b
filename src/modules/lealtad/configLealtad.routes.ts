import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const configLealtadRouter = Router();
configLealtadRouter.use(requireAuth);

/** GET /config-lealtad — tasa de acumulación (quetzales por punto). */
configLealtadRouter.get(
  '/',
  ah(async (req, res) => {
    const cfg = await prisma.configLealtad.findUnique({ where: { sucursalId: req.user!.sucursalId } });
    res.json({ quetzalesPorPunto: Number(cfg?.quetzalesPorPunto ?? 10), activo: cfg?.activo ?? true });
  }),
);

/** PATCH /config-lealtad — actualiza la tasa (solo admin). */
configLealtadRouter.patch(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const { quetzalesPorPunto } = z.object({ quetzalesPorPunto: z.number().positive() }).parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const cfg = await prisma.configLealtad.upsert({
      where: { sucursalId },
      create: { sucursalId, quetzalesPorPunto },
      update: { quetzalesPorPunto },
    });
    res.json({ quetzalesPorPunto: Number(cfg.quetzalesPorPunto), activo: cfg.activo });
  }),
);
