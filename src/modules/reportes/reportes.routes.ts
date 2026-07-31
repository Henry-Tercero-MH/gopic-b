import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const reportesRouter = Router();
reportesRouter.use(requireAuth);

const iniciales = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

/** GET /reportes — panel de reportes del mes en curso (datos reales). */
reportesRouter.get(
  '/',
  ah(async (req, res) => {
    const sucursalId = req.user!.sucursalId;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const desde7 = new Date(ahora);
    desde7.setDate(desde7.getDate() - 6);
    desde7.setHours(0, 0, 0, 0);

    const [
      ingresosAgg,
      gastosPorCategoria,
      ventasPorDiaRaw,
      ventasPorCategoria,
      rentabilidadRaw,
      topVendedoresRaw,
      lealtadRaw,
      recompensasCanjeadas,
      topClientes,
    ] = await Promise.all([
      prisma.factura.aggregate({
        _sum: { total: true },
        where: { sucursalId, estado: 'emitida', emitidaEn: { gte: inicioMes } },
      }),
      prisma.$queryRaw<{ categoria: string; monto: string }[]>`
        SELECT cg.nombre AS categoria, SUM(g.monto) AS monto
        FROM gasto g JOIN categoria_gasto cg ON cg.id = g.categoria_gasto_id
        WHERE g.sucursal_id = ${sucursalId}::uuid AND g.fecha >= ${inicioMes}
        GROUP BY cg.nombre ORDER BY monto DESC`,
      prisma.$queryRaw<{ dia: Date; monto: string }[]>`
        SELECT (emitida_en AT TIME ZONE 'America/Guatemala')::date AS dia, SUM(total) AS monto
        FROM factura
        WHERE sucursal_id = ${sucursalId}::uuid AND estado = 'emitida' AND emitida_en >= ${desde7}
        GROUP BY dia ORDER BY dia`,
      prisma.$queryRaw<{ categoria: string; monto: string }[]>`
        SELECT c.nombre AS categoria, SUM(fd.cantidad * fd.precio_unitario) AS monto
        FROM factura_detalle fd
        JOIN factura f ON f.id = fd.factura_id
        JOIN producto p ON p.id = fd.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        WHERE f.sucursal_id = ${sucursalId}::uuid AND f.estado = 'emitida' AND f.emitida_en >= ${inicioMes}
        GROUP BY c.nombre ORDER BY monto DESC`,
      prisma.$queryRaw<{ producto: string; vendidos: number; ingreso: string; costo: string }[]>`
        SELECT p.nombre AS producto,
               SUM(fd.cantidad)::int AS vendidos,
               SUM(fd.cantidad * fd.precio_unitario) AS ingreso,
               COALESCE(MAX(r.costo_calculado), 0) * SUM(fd.cantidad) AS costo
        FROM factura_detalle fd
        JOIN factura f ON f.id = fd.factura_id
        JOIN producto p ON p.id = fd.producto_id
        LEFT JOIN receta r ON r.producto_id = p.id AND r.deleted_at IS NULL
        WHERE f.sucursal_id = ${sucursalId}::uuid AND f.estado = 'emitida' AND f.emitida_en >= ${inicioMes}
        GROUP BY p.nombre ORDER BY ingreso DESC LIMIT 10`,
      prisma.$queryRaw<{ nombre: string; monto: string; tickets: number }[]>`
        SELECT COALESCE(u.nombre, e.nombre, u.email) AS nombre,
               SUM(f.total) AS monto, COUNT(*)::int AS tickets
        FROM factura f
        JOIN usuario u ON u.id = f.usuario_id
        LEFT JOIN empleado e ON e.id = u.empleado_id
        WHERE f.sucursal_id = ${sucursalId}::uuid AND f.estado = 'emitida' AND f.emitida_en >= ${inicioMes}
        GROUP BY u.id, u.nombre, e.nombre, u.email ORDER BY monto DESC`,
      prisma.movimientoLealtad.groupBy({
        by: ['tipo'],
        _sum: { puntos: true },
        where: { createdAt: { gte: inicioMes }, cliente: { sucursalId } },
      }),
      prisma.$queryRaw<{ nombre: string; veces: number }[]>`
        SELECT rc.nombre, COUNT(*)::int AS veces
        FROM movimiento_lealtad ml
        JOIN recompensa rc ON rc.id = ml.recompensa_id
        JOIN cliente c ON c.id = ml.cliente_id
        WHERE c.sucursal_id = ${sucursalId}::uuid AND ml.tipo = 'canjea' AND ml.created_at >= ${inicioMes}
        GROUP BY rc.nombre ORDER BY veces DESC`,
      prisma.cliente.findMany({
        where: { sucursalId, deletedAt: null, puntos: { gt: 0 } },
        select: { id: true, nombre: true, puntos: true },
        orderBy: { puntos: 'desc' },
        take: 5,
      }),
    ]);

    const ingresos = Number(ingresosAgg._sum.total ?? 0);
    const gastosCat = gastosPorCategoria.map((g) => ({ categoria: g.categoria, monto: Number(g.monto) }));
    const gastos = gastosCat.reduce((s, g) => s + g.monto, 0);

    // Serie de 7 días con etiqueta de día (rellena los días sin ventas con 0).
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const mapaDia = new Map(ventasPorDiaRaw.map((v) => [new Date(v.dia).toISOString().slice(0, 10), Number(v.monto)]));
    const ventasPorDia: { dia: string; monto: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
      ventasPorDia.push({ dia: dias[d.getDay()], monto: mapaDia.get(key) ?? 0 });
    }

    const totalVentasCat = ventasPorCategoria.reduce((s, c) => s + Number(c.monto), 0) || 1;
    const totalGastos = gastos || 1;

    const acum = lealtadRaw.find((r) => r.tipo === 'acumula');
    const canj = lealtadRaw.find((r) => r.tipo === 'canjea');

    res.json({
      periodo: inicioMes.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' }),
      ingresos,
      gastos,
      gastosPorCategoria: gastosCat.map((g) => ({ ...g, pct: (g.monto / totalGastos) * 100 })),
      ventasPorDia,
      ventasPorCategoria: ventasPorCategoria.map((c) => ({
        categoria: c.categoria,
        monto: Number(c.monto),
        pct: (Number(c.monto) / totalVentasCat) * 100,
      })),
      rentabilidadProductos: rentabilidadRaw.map((p) => {
        const ingreso = Number(p.ingreso);
        const costo = Number(p.costo);
        return {
          producto: p.producto,
          vendidos: Number(p.vendidos),
          ingreso,
          costo,
          margen: ingreso > 0 ? Math.round(((ingreso - costo) / ingreso) * 100) : 0,
        };
      }),
      topVendedores: topVendedoresRaw.map((v) => ({
        nombre: v.nombre,
        iniciales: iniciales(v.nombre),
        monto: Number(v.monto),
        tickets: Number(v.tickets),
      })),
      fidelizacion: {
        puntosOtorgados: acum?._sum.puntos ?? 0,
        puntosCanjeados: Math.abs(canj?._sum.puntos ?? 0),
        recompensasCanjeadas: recompensasCanjeadas.map((r) => ({ nombre: r.nombre, veces: Number(r.veces) })),
        topClientes: topClientes.map((c) => ({ nombre: c.nombre, puntos: c.puntos })),
      },
    });
  }),
);
