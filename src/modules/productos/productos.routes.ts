import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const productosRouter = Router();

// Todas las rutas requieren sesión; las mutaciones, además, rol admin.
productosRouter.use(requireAuth);

const crearSchema = z.object({
  categoriaId: z.string().uuid(),
  nombre: z.string().min(1).max(120),
  precio: z.number().nonnegative(),
  estacion: z.enum(['Barra', 'Cocina']),
  destacado: z.boolean().optional(),
  imagenUrl: z.string().url().max(500).optional(),
});
const editarSchema = crearSchema.partial();

/** GET /productos — catálogo de la sucursal del usuario. */
productosRouter.get(
  '/',
  ah(async (req, res) => {
    const productos = await prisma.producto.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { categoria: { select: { id: true, nombre: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(productos);
  }),
);

/** GET /productos/:id */
productosRouter.get(
  '/:id',
  ah(async (req, res) => {
    const producto = await prisma.producto.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { categoria: true },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  }),
);

/** POST /productos — crea (solo admin). */
productosRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const datos = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    // La categoría debe existir y ser de la misma sucursal.
    const categoria = await prisma.categoria.findFirst({
      where: { id: datos.categoriaId, sucursalId, deletedAt: null },
    });
    if (!categoria) return res.status(400).json({ error: 'Categoría inválida' });

    const producto = await prisma.producto.create({ data: { ...datos, sucursalId } });
    res.status(201).json(producto);
  }),
);

/** PATCH /productos/:id — edita (solo admin). */
productosRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const datos = editarSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, sucursalId, deletedAt: null } });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });

    if (datos.categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: datos.categoriaId, sucursalId, deletedAt: null },
      });
      if (!categoria) return res.status(400).json({ error: 'Categoría inválida' });
    }

    const producto = await prisma.producto.update({ where: { id: req.params.id }, data: datos });
    res.json(producto);
  }),
);

/** DELETE /productos/:id — borrado lógico (solo admin). */
productosRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const sucursalId = req.user!.sucursalId;
    const existe = await prisma.producto.findFirst({ where: { id: req.params.id, sucursalId, deletedAt: null } });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });

    await prisma.producto.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), activo: false } });
    res.status(204).send();
  }),
);
