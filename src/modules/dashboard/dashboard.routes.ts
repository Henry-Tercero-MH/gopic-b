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
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const whereHoy = { sucursalId, estado: 'emitida' as const, emitidaEn: { gte: hoy } };

    const [agg, aggAyer, ultimasRaw, topProductos, porHoraRaw, lealtadRaw, clientesAgg, clientesConPuntos] =
      await Promise.all([
      prisma.factura.aggregate({ _sum: { total: true }, _count: true, where: whereHoy }),
      prisma.factura.aggregate({
        _sum: { total: true },
        where: { sucursalId, estado: 'emitida', emitidaEn: { gte: ayer, lt: hoy } },
      }),
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
      prisma.$queryRaw<{ hora: number; monto: string }[]>`
        SELECT EXTRACT(HOUR FROM emitida_en AT TIME ZONE 'America/Guatemala')::int AS hora,
               SUM(total) AS monto
        FROM factura
        WHERE sucursal_id = ${sucursalId}::uuid AND estado = 'emitida' AND emitida_en >= ${hoy}
        GROUP BY hora
        ORDER BY hora`,
      prisma.movimientoLealtad.groupBy({
        by: ['tipo'],
        _sum: { puntos: true },
        _count: true,
        where: { createdAt: { gte: hoy }, cliente: { sucursalId } },
      }),
      prisma.cliente.aggregate({ _sum: { puntos: true }, _count: true, where: { sucursalId, deletedAt: null } }),
      prisma.cliente.count({ where: { sucursalId, deletedAt: null, puntos: { gt: 0 } } }),
    ]);

    const ventasHoy = Number(agg._sum.total ?? 0);
    const transacciones = agg._count;

    const acum = lealtadRaw.find((r) => r.tipo === 'acumula');
    const canj = lealtadRaw.find((r) => r.tipo === 'canjea');

    res.json({
      ventasHoy,
      ventasAyer: Number(aggAyer._sum.total ?? 0),
      transacciones,
      ticketPromedio: transacciones > 0 ? ventasHoy / transacciones : 0,
      ventasPorHora: porHoraRaw.map((h) => ({ hora: Number(h.hora), monto: Number(h.monto) })),
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
      lealtad: {
        puntosOtorgados: acum?._sum.puntos ?? 0,
        puntosCanjeados: Math.abs(canj?._sum.puntos ?? 0),
        canjes: canj?._count ?? 0,
        clientesConPuntos,
        puntosEnCirculacion: clientesAgg._sum.puntos ?? 0,
        totalClientes: clientesAgg._count,
      },
    });
  }),
);
