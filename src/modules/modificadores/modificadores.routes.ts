import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const modificadoresRouter = Router();
modificadoresRouter.use(requireAuth);

/** GET /modificadores — grupos de modificadores de la sucursal con sus opciones. */
modificadoresRouter.get(
  '/',
  ah(async (req, res) => {
    const grupos = await prisma.grupoModificador.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: {
        opciones: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(
      grupos.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        requerido: g.requerido,
        multiple: g.multiple,
        opciones: g.opciones.map((o) => ({ id: o.id, nombre: o.nombre, precio: Number(o.precioExtra) })),
      })),
    );
  }),
);
