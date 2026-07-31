import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const proveedoresRouter = Router();
proveedoresRouter.use(requireAuth);

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  contacto: z.string().max(120).optional(),
  telefono: z.string().max(30).optional(),
  email: z.string().max(160).optional(),
});
const editarSchema = crearSchema.partial();

const dto = (p: { id: string; nombre: string; contacto: string | null; telefono: string | null; email: string | null }) => ({
  id: p.id,
  nombre: p.nombre,
  contacto: p.contacto ?? '',
  telefono: p.telefono ?? '',
  email: p.email ?? '',
});

/** GET /proveedores — proveedores de la sucursal. */
proveedoresRouter.get(
  '/',
  ah(async (req, res) => {
    const proveedores = await prisma.proveedor.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      orderBy: { nombre: 'asc' },
    });
    res.json(proveedores.map(dto));
  }),
);

proveedoresRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const p = await prisma.proveedor.create({
      data: {
        sucursalId: req.user!.sucursalId,
        nombre: d.nombre,
        contacto: d.contacto || null,
        telefono: d.telefono || null,
        email: d.email || null,
      },
    });
    res.status(201).json(dto(p));
  }),
);

proveedoresRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.proveedor.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const p = await prisma.proveedor.update({
      where: { id: req.params.id },
      data: {
        nombre: d.nombre,
        contacto: d.contacto !== undefined ? d.contacto || null : undefined,
        telefono: d.telefono !== undefined ? d.telefono || null : undefined,
        email: d.email !== undefined ? d.email || null : undefined,
      },
    });
    res.json(dto(p));
  }),
);

proveedoresRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.proveedor.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await prisma.proveedor.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
