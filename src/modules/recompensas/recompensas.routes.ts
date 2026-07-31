import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const recompensasRouter = Router();
recompensasRouter.use(requireAuth);

const tipos = ['producto', 'descuento_monto', 'descuento_pct'] as const;

const dto = (r: {
  id: string;
  nombre: string;
  tipo: string;
  costoPuntos: number;
  productoId: string | null;
  valor: unknown;
  activa: boolean;
}) => ({
  id: r.id,
  nombre: r.nombre,
  tipo: r.tipo,
  costoPuntos: r.costoPuntos,
  productoId: r.productoId,
  valor: r.valor != null ? Number(r.valor) : null,
  activa: r.activa,
});

/** GET /recompensas — recompensas de la sucursal (todas; `?activas=1` solo activas). */
recompensasRouter.get(
  '/',
  ah(async (req, res) => {
    const soloActivas = req.query.activas === '1';
    const recompensas = await prisma.recompensa.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null, ...(soloActivas ? { activa: true } : {}) },
      orderBy: { costoPuntos: 'asc' },
    });
    res.json(recompensas.map(dto));
  }),
);

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  tipo: z.enum(tipos),
  costoPuntos: z.number().int().positive(),
  productoId: z.string().uuid().optional(),
  valor: z.number().nonnegative().optional(),
  activa: z.boolean().optional(),
});
const editarSchema = crearSchema.partial();

recompensasRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    if (d.tipo === 'producto' && !d.productoId) return res.status(400).json({ error: 'Falta el producto a regalar' });
    const r = await prisma.recompensa.create({
      data: {
        sucursalId: req.user!.sucursalId,
        nombre: d.nombre,
        tipo: d.tipo,
        costoPuntos: d.costoPuntos,
        productoId: d.tipo === 'producto' ? d.productoId : null,
        valor: d.tipo === 'producto' ? null : (d.valor ?? 0),
        activa: d.activa ?? true,
      },
    });
    res.status(201).json(dto(r));
  }),
);

recompensasRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.recompensa.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Recompensa no encontrada' });
    const r = await prisma.recompensa.update({
      where: { id: req.params.id },
      data: {
        nombre: d.nombre,
        tipo: d.tipo,
        costoPuntos: d.costoPuntos,
        activa: d.activa,
        ...(d.tipo ? { productoId: d.tipo === 'producto' ? (d.productoId ?? existe.productoId) : null } : {}),
        ...(d.valor !== undefined ? { valor: d.valor } : {}),
      },
    });
    res.json(dto(r));
  }),
);

recompensasRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const existe = await prisma.recompensa.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Recompensa no encontrada' });
    await prisma.recompensa.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), activa: false } });
    res.status(204).send();
  }),
);
