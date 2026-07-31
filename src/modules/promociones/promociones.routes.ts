import { Router } from 'express';
import { z } from 'zod';
import type { TipoPromo } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const promocionesRouter = Router();
promocionesRouter.use(requireAuth);

// El frontend usa '2x1'; en el cliente Prisma el miembro del enum es `dos_x_uno`.
const aApi = (t: TipoPromo): string => (t === 'dos_x_uno' ? '2x1' : t);
const deInput = (t: string): TipoPromo => (t === '2x1' ? 'dos_x_uno' : (t as TipoPromo));

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  tipo: z.enum(['porcentaje', 'monto', '2x1', 'combo']),
  valor: z.number().nonnegative(),
  aplicaEn: z.string().max(120).optional(),
  vigencia: z.string().max(120).optional(),
  activa: z.boolean().optional(),
});
const editarSchema = crearSchema.partial();

const dto = (p: {
  id: string;
  nombre: string;
  tipo: TipoPromo;
  valor: unknown;
  aplicaEn: string | null;
  vigencia: string | null;
  activa: boolean;
}) => ({
  id: p.id,
  nombre: p.nombre,
  tipo: aApi(p.tipo),
  valor: Number(p.valor),
  aplicaEn: p.aplicaEn ?? '',
  vigencia: p.vigencia ?? '',
  activa: p.activa,
});

/** GET /promociones — promociones de la sucursal. */
promocionesRouter.get(
  '/',
  ah(async (req, res) => {
    const promos = await prisma.promocion.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json(promos.map(dto));
  }),
);

promocionesRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const p = await prisma.promocion.create({
      data: {
        sucursalId: req.user!.sucursalId,
        nombre: d.nombre,
        tipo: deInput(d.tipo),
        valor: d.valor,
        aplicaEn: d.aplicaEn || null,
        vigencia: d.vigencia || null,
        activa: d.activa ?? true,
      },
    });
    res.status(201).json(dto(p));
  }),
);

promocionesRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.promocion.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Promoción no encontrada' });

    const p = await prisma.promocion.update({
      where: { id: req.params.id },
      data: {
        nombre: d.nombre,
        tipo: d.tipo ? deInput(d.tipo) : undefined,
        valor: d.valor,
        aplicaEn: d.aplicaEn !== undefined ? d.aplicaEn || null : undefined,
        vigencia: d.vigencia !== undefined ? d.vigencia || null : undefined,
        activa: d.activa,
      },
    });
    res.json(dto(p));
  }),
);

promocionesRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.promocion.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Promoción no encontrada' });
    await prisma.promocion.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
