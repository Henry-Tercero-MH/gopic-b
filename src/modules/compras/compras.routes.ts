import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const comprasRouter = Router();
comprasRouter.use(requireAuth);

const fmtFecha = (d: Date) =>
  new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const crearSchema = z.object({
  proveedorId: z.string().uuid(),
  items: z
    .array(
      z.object({
        insumoId: z.string().uuid(),
        cantidad: z.number().positive(),
        costoUnitario: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** GET /ordenes-compra — órdenes de la sucursal con su detalle. */
comprasRouter.get(
  '/',
  ah(async (req, res) => {
    const ordenes = await prisma.ordenCompra.findMany({
      where: { sucursalId: req.user!.sucursalId },
      include: {
        proveedor: { select: { nombre: true } },
        detalles: { include: { insumo: { select: { nombre: true, unidadMedida: { select: { abreviatura: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      ordenes.map((o) => ({
        id: o.id,
        folio: o.folio,
        proveedor: o.proveedor.nombre,
        fecha: fmtFecha(o.fecha),
        estado: o.estado,
        items: o.detalles.map((d) => ({
          insumo: d.insumo.nombre,
          cantidad: Number(d.cantidad),
          unidad: d.insumo.unidadMedida.abreviatura,
          costoUnitario: Number(d.costoUnitario),
        })),
      })),
    );
  }),
);

/** POST /ordenes-compra — crea una orden en borrador. */
comprasRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedorId, sucursalId, deletedAt: null } });
    if (!proveedor) return res.status(400).json({ error: 'Proveedor inválido' });

    const insumos = await prisma.insumo.findMany({
      where: { id: { in: d.items.map((i) => i.insumoId) }, sucursalId, deletedAt: null },
      select: { id: true },
    });
    if (insumos.length !== new Set(d.items.map((i) => i.insumoId)).size) {
      return res.status(400).json({ error: 'Algún insumo es inválido' });
    }

    const total = d.items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);
    const count = await prisma.ordenCompra.count({ where: { sucursalId } });
    const folio = `OC-${String(count + 1).padStart(4, '0')}`;

    const orden = await prisma.ordenCompra.create({
      data: {
        sucursalId,
        proveedorId: d.proveedorId,
        usuarioId: req.user!.sub,
        folio,
        total,
        detalles: {
          create: d.items.map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario })),
        },
      },
    });
    res.status(201).json({ id: orden.id, folio: orden.folio });
  }),
);

/** POST /ordenes-compra/:id/recibir — ingresa la mercadería al inventario (Entrada por detalle). */
comprasRouter.post(
  '/:id/recibir',
  ah(async (req, res) => {
    const sucursalId = req.user!.sucursalId;
    const usuarioId = req.user!.sub;
    const orden = await prisma.ordenCompra.findFirst({
      where: { id: req.params.id, sucursalId },
      include: { detalles: true },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.estado === 'recibida') return res.status(409).json({ error: 'La orden ya fue recibida' });
    if (orden.estado === 'cancelada') return res.status(409).json({ error: 'La orden está cancelada' });

    await prisma.$transaction(async (tx) => {
      for (const det of orden.detalles) {
        await tx.$queryRaw`SELECT registrar_movimiento_inventario(${det.insumoId}::uuid, ${sucursalId}::uuid, 'Entrada', ${Number(det.cantidad)}::numeric, ${Number(det.costoUnitario)}::numeric, ${'Recepción OC ' + orden.folio}, ${usuarioId}::uuid, ${orden.id}::uuid, NULL, NULL)`;
      }
      await tx.ordenCompra.update({ where: { id: orden.id }, data: { estado: 'recibida' } });
    });
    res.json({ ok: true });
  }),
);

/** DELETE /ordenes-compra/:id — elimina la orden (no permitido si ya fue recibida). */
comprasRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const orden = await prisma.ordenCompra.findFirst({ where: { id: req.params.id, sucursalId: req.user!.sucursalId } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.estado === 'recibida') return res.status(409).json({ error: 'No se puede eliminar una orden recibida' });
    await prisma.ordenCompra.delete({ where: { id: orden.id } });
    res.status(204).send();
  }),
);
