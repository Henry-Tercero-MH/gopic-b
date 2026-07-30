import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const mesasRouter = Router();
mesasRouter.use(requireAuth);

const crearSchema = z.object({
  nombre: z.string().min(1).max(40),
  zona: z.string().min(1).max(60),
  capacidad: z.number().int().positive(),
});
const editarSchema = crearSchema.partial();

/** Busca la zona por nombre en la sucursal; la crea si no existe. */
async function zonaId(sucursalId: string, nombre: string): Promise<string> {
  const existente = await prisma.zona.findFirst({ where: { sucursalId, nombre, deletedAt: null } });
  if (existente) return existente.id;
  const nueva = await prisma.zona.create({ data: { sucursalId, nombre } });
  return nueva.id;
}

/** GET /mesas — mesas de la sucursal con su zona. */
mesasRouter.get(
  '/',
  ah(async (req, res) => {
    const mesas = await prisma.mesa.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { zona: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(
      mesas.map((m) => ({ id: m.id, nombre: m.nombre, capacidad: m.capacidad, estado: m.estado, zona: m.zona.nombre })),
    );
  }),
);

mesasRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const mesa = await prisma.mesa.create({
      data: { sucursalId, zonaId: await zonaId(sucursalId, d.zona), nombre: d.nombre, capacidad: d.capacidad, estado: 'libre' },
      include: { zona: { select: { nombre: true } } },
    });
    res.status(201).json({ id: mesa.id, nombre: mesa.nombre, capacidad: mesa.capacidad, estado: mesa.estado, zona: mesa.zona.nombre });
  }),
);

mesasRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const existe = await prisma.mesa.findFirst({ where: { id: req.params.id, sucursalId, deletedAt: null } });
    if (!existe) return res.status(404).json({ error: 'Mesa no encontrada' });

    const mesa = await prisma.mesa.update({
      where: { id: req.params.id },
      data: {
        nombre: d.nombre,
        capacidad: d.capacidad,
        ...(d.zona ? { zonaId: await zonaId(sucursalId, d.zona) } : {}),
      },
      include: { zona: { select: { nombre: true } } },
    });
    res.json({ id: mesa.id, nombre: mesa.nombre, capacidad: mesa.capacidad, estado: mesa.estado, zona: mesa.zona.nombre });
  }),
);

mesasRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const existe = await prisma.mesa.findFirst({ where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null } });
    if (!existe) return res.status(404).json({ error: 'Mesa no encontrada' });
    if (existe.estado !== 'libre' && existe.estado !== 'reservada') {
      return res.status(409).json({ error: 'La mesa tiene una cuenta abierta.' });
    }
    await prisma.mesa.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
