import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** GET /dashboard — KPIs del día, últimas ventas y más vendidos (datos reales). */
dashboardRouter.get(
  '/',
  ah(async (req, res) => {
    const sucursalId = req.user!.sucursalId;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const whereHoy = { sucursalId, estado: 'emitida' as const, emitidaEn: { gte: hoy } };

    const [agg, ultimasRaw, topProductos] = await Promise.all([
      prisma.factura.aggregate({ _sum: { total: true }, _count: true, where: whereHoy }),
      prisma.factura.findMany({
        where: { sucursalId, estado: 'emitida' },
        orderBy: { emitidaEn: 'desc' },
        take: 8,
        select: { id: true, folio: true, serie: true, total: true, tipoVenta: true, emitidaEn: true },
      }),
      prisma.$queryRaw<{ nombre: string; unidades: number; ingreso: string }[]>`
        SELECT p.nombre, SUM(fd.cantidad)::int AS unidades, SUM(fd.cantidad * fd.precio_unitario) AS ingreso
        FROM factura_detalle fd
        JOIN factura f ON f.id = fd.factura_id
        JOIN producto p ON p.id = fd.producto_id
        WHERE f.sucursal_id = ${sucursalId}::uuid AND f.estado = 'emitida' AND f.emitida_en >= ${hoy}
        GROUP BY p.nombre
        ORDER BY ingreso DESC
        LIMIT 6`,
    ]);

    const ventasHoy = Number(agg._sum.total ?? 0);
    const transacciones = agg._count;

    res.json({
      ventasHoy,
      transacciones,
      ticketPromedio: transacciones > 0 ? ventasHoy / transacciones : 0,
      ultimasVentas: ultimasRaw.map((f) => ({
        id: f.id,
        folio: Number(f.folio),
        serie: f.serie,
        total: Number(f.total),
        tipoVenta: f.tipoVenta,
        hora: new Date(f.emitidaEn).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
      })),
      topProductos: topProductos.map((t) => ({
        nombre: t.nombre,
        unidades: Number(t.unidades),
        ingreso: Number(t.ingreso),
      })),
    });
  }),
);
