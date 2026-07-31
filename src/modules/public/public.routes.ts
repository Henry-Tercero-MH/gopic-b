import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';

/** Rutas públicas (sin autenticación): carta digital para QR. */
export const publicRouter = Router();

/** GET /public/carta — menú de la sucursal (categorías, productos y promos activas). */
publicRouter.get(
  '/carta',
  ah(async (req, res) => {
    // Sucursal indicada por query `?s=<id>`; si no, la primera activa (single-tenant).
    const sucursalId = typeof req.query.s === 'string' ? req.query.s : undefined;
    const sucursal = sucursalId
      ? await prisma.sucursal.findFirst({ where: { id: sucursalId, activo: true, deletedAt: null } })
      : await prisma.sucursal.findFirst({ where: { activo: true, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!sucursal) return res.status(404).json({ error: 'Sucursal no encontrada' });

    const [categorias, productos, promociones] = await Promise.all([
      prisma.categoria.findMany({
        where: { sucursalId: sucursal.id, deletedAt: null },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      }),
      prisma.producto.findMany({
        where: { sucursalId: sucursal.id, deletedAt: null, activo: true },
        include: { gruposMod: { select: { grupoModificadorId: true } } },
        orderBy: { nombre: 'asc' },
      }),
      prisma.promocion.findMany({
        where: { sucursalId: sucursal.id, deletedAt: null, activa: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      negocio: { nombre: sucursal.nombre },
      categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono })),
      productos: productos.map((p) => ({
        id: p.id,
        categoriaId: p.categoriaId,
        nombre: p.nombre,
        precio: Number(p.precio),
        imagen: p.imagenUrl,
        destacado: p.destacado,
        personalizable: p.gruposMod.length > 0,
      })),
      promociones: promociones.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        aplicaEn: p.aplicaEn ?? '',
        vigencia: p.vigencia ?? '',
      })),
    });
  }),
);
