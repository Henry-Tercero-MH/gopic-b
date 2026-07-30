import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const categoriasRouter = Router();
categoriasRouter.use(requireAuth);

const crearSchema = z.object({
  nombre: z.string().min(1).max(80),
  icono: z.string().max(40).optional(),
  orden: z.number().int().optional(),
});
const editarSchema = crearSchema.partial();

/** GET /categorias — categorías de la sucursal. */
categoriasRouter.get(
  '/',
  ah(async (req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    res.json(categorias);
  }),
);

categoriasRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const datos = crearSchema.parse(req.body);
    const categoria = await prisma.categoria.create({ data: { ...datos, sucursalId: req.user!.sucursalId } });
    res.status(201).json(categoria);
  }),
);

categoriasRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const datos = editarSchema.parse(req.body);
    const existe = await prisma.categoria.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Categoría no encontrada' });
    const categoria = await prisma.categoria.update({ where: { id: req.params.id }, data: datos });
    res.json(categoria);
  }),
);

categoriasRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const existe = await prisma.categoria.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Categoría no encontrada' });
    await prisma.categoria.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
