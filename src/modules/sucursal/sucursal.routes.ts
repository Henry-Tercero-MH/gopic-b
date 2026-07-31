import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const sucursalRouter = Router();
sucursalRouter.use(requireAuth);

const dto = (s: { id: string; nombre: string; nit: string; direccion: string; telefono: string; moneda: string }) => ({
  id: s.id,
  nombre: s.nombre,
  nit: s.nit,
  direccion: s.direccion,
  telefono: s.telefono,
  moneda: s.moneda,
});

/** GET /sucursal — datos de la sucursal del usuario. */
sucursalRouter.get(
  '/',
  ah(async (req, res) => {
    const s = await prisma.sucursal.findUnique({ where: { id: req.user!.sucursalId } });
    if (!s) return res.status(404).json({ error: 'Sucursal no encontrada' });
    res.json(dto(s));
  }),
);

const editarSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  nit: z.string().min(1).max(20).optional(),
  direccion: z.string().min(1).max(200).optional(),
  telefono: z.string().min(1).max(30).optional(),
  moneda: z.string().length(3).optional(),
});

/** PATCH /sucursal — actualiza los datos del negocio (solo admin). */
sucursalRouter.patch(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const s = await prisma.sucursal.update({ where: { id: req.user!.sucursalId }, data: d });
    res.json(dto(s));
  }),
);
