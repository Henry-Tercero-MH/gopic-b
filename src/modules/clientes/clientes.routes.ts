import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  nit: z.string().max(20).optional(),
  telefono: z.string().max(30).optional(),
  email: z.string().email().max(160).optional().or(z.literal('')),
});
const editarSchema = crearSchema.partial();

/** GET /clientes — clientes de la sucursal (con puntos y visitas). */
clientesRouter.get(
  '/',
  ah(async (req, res) => {
    const clientes = await prisma.cliente.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      orderBy: { nombre: 'asc' },
    });
    res.json(clientes);
  }),
);

/** GET /clientes/:id/movimientos — historial de puntos. */
clientesRouter.get(
  '/:id/movimientos',
  ah(async (req, res) => {
    const movimientos = await prisma.movimientoLealtad.findMany({
      where: { cliente: { id: req.params.id, sucursalId: req.user!.sucursalId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(movimientos);
  }),
);

clientesRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const cliente = await prisma.cliente.create({
      data: {
        sucursalId: req.user!.sucursalId,
        nombre: d.nombre,
        nit: d.nit || null,
        telefono: d.telefono || null,
        email: d.email || null,
      },
    });
    res.status(201).json(cliente);
  }),
);

clientesRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.cliente.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Cliente no encontrado' });
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { ...d, email: d.email === '' ? null : d.email },
    });
    res.json(cliente);
  }),
);

clientesRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.cliente.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Cliente no encontrado' });
    await prisma.cliente.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
