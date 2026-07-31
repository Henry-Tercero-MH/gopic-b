import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const recetasRouter = Router();
recetasRouter.use(requireAuth);

const upsertSchema = z.object({
  productoId: z.string().uuid(),
  rendimiento: z.number().positive().optional(),
  items: z
    .array(
      z.object({
        insumoId: z.string().uuid(),
        cantidad: z.number().positive(),
        mermaPct: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
});

/** Costo de un ingrediente = cantidad · (1 + merma%) · costo promedio del insumo. */
const costoItem = (cantidad: number, mermaPct: number, costoPromedio: number) =>
  cantidad * (1 + mermaPct / 100) * costoPromedio;

/** GET /recetas — recetas de la sucursal con costeo derivado del inventario. */
recetasRouter.get(
  '/',
  ah(async (req, res) => {
    const recetas = await prisma.receta.findMany({
      where: { deletedAt: null, producto: { sucursalId: req.user!.sucursalId, deletedAt: null } },
      include: {
        producto: { select: { nombre: true, precio: true } },
        detalles: {
          include: { insumo: { select: { nombre: true, costoPromedio: true, unidadMedida: { select: { abreviatura: true } } } } },
        },
      },
    });
    res.json(
      recetas.map((r) => {
        const detalle = r.detalles.map((d) => {
          const cantidad = Number(d.cantidad);
          const merma = Number(d.mermaPct);
          const costo = costoItem(cantidad, merma, Number(d.insumo.costoPromedio));
          return {
            insumo: d.insumo.nombre,
            cantidad: `${cantidad} ${d.insumo.unidadMedida.abreviatura}`,
            merma: `${merma}%`,
            costo,
          };
        });
        return {
          id: r.id,
          productoId: r.productoId,
          producto: r.producto.nombre,
          emoji: '🍽️',
          precioVenta: Number(r.producto.precio),
          costo: detalle.reduce((s, d) => s + d.costo, 0),
          detalle,
          items: r.detalles.map((d) => ({ insumoId: d.insumoId, cantidad: Number(d.cantidad), mermaPct: Number(d.mermaPct) })),
        };
      }),
    );
  }),
);

/** POST /recetas — crea o reemplaza la receta de un producto. */
recetasRouter.post(
  '/',
  ah(async (req, res) => {
    const d = upsertSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    const producto = await prisma.producto.findFirst({ where: { id: d.productoId, sucursalId, deletedAt: null } });
    if (!producto) return res.status(400).json({ error: 'Producto inválido' });

    const insumos = await prisma.insumo.findMany({
      where: { id: { in: d.items.map((i) => i.insumoId) }, sucursalId, deletedAt: null },
      select: { id: true, costoPromedio: true },
    });
    if (insumos.length !== new Set(d.items.map((i) => i.insumoId)).size) {
      return res.status(400).json({ error: 'Algún insumo es inválido' });
    }
    const costoDe = new Map(insumos.map((i) => [i.id, Number(i.costoPromedio)]));
    const costoCalculado = d.items.reduce(
      (s, i) => s + costoItem(i.cantidad, i.mermaPct ?? 0, costoDe.get(i.insumoId) ?? 0),
      0,
    );

    const receta = await prisma.$transaction(async (tx) => {
      const r = await tx.receta.upsert({
        where: { productoId: d.productoId },
        create: { productoId: d.productoId, rendimiento: d.rendimiento ?? 1, costoCalculado },
        update: { rendimiento: d.rendimiento ?? 1, costoCalculado, deletedAt: null },
      });
      await tx.recetaDetalle.deleteMany({ where: { recetaId: r.id } });
      await tx.recetaDetalle.createMany({
        data: d.items.map((i) => ({ recetaId: r.id, insumoId: i.insumoId, cantidad: i.cantidad, mermaPct: i.mermaPct ?? 0 })),
      });
      return r;
    });
    res.status(201).json({ id: receta.id });
  }),
);

/** DELETE /recetas/:id — borrado lógico de la receta. */
recetasRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const receta = await prisma.receta.findFirst({
      where: { id: req.params.id, deletedAt: null, producto: { sucursalId: req.user!.sucursalId } },
    });
    if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });
    await prisma.receta.update({ where: { id: receta.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
