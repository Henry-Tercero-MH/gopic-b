import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const inventarioRouter = Router();
inventarioRouter.use(requireAuth);

/** Nivel de stock derivado de la existencia y el mínimo. */
function nivel(existencia: number, minimo: number): 'ok' | 'bajo' | 'critico' {
  if (existencia <= minimo * 0.5) return 'critico';
  if (existencia <= minimo) return 'bajo';
  return 'ok';
}

/** GET /insumos — catálogo de insumos con existencia y nivel. */
inventarioRouter.get(
  '/',
  ah(async (req, res) => {
    const insumos = await prisma.insumo.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { unidadMedida: { select: { abreviatura: true } }, existencia: { select: { cantidad: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(
      insumos.map((i) => {
        const existencia = Number(i.existencia?.cantidad ?? 0);
        const minimo = Number(i.stockMinimo);
        return {
          id: i.id,
          nombre: i.nombre,
          categoria: i.categoria,
          tipo: i.tipo,
          unidad: i.unidadMedida.abreviatura,
          existencia,
          minimo,
          costoUnitario: Number(i.costoPromedio),
          nivel: nivel(existencia, minimo),
        };
      }),
    );
  }),
);

/** GET /insumos/:id/kardex — últimos movimientos del insumo. */
inventarioRouter.get(
  '/:id/kardex',
  ah(async (req, res) => {
    const insumo = await prisma.insumo.findFirst({ where: { id: req.params.id, sucursalId: req.user!.sucursalId } });
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

    const movs = await prisma.movimientoInventario.findMany({
      where: { insumoId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(
      movs.map((m) => ({
        fecha: new Date(m.createdAt).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        tipo: m.tipo,
        documento: m.motivo ?? '—',
        cantidad: Number(m.cantidad),
        saldo: Number(m.saldo),
      })),
    );
  }),
);

/** POST /insumos/reproceso — convierte un insumo en su derivado (usa la función de kardex). */
inventarioRouter.post(
  '/reproceso',
  ah(async (req, res) => {
    const { origenId, consumo, destinoId, produccion } = z
      .object({
        origenId: z.string().uuid(),
        consumo: z.number().positive(),
        destinoId: z.string().uuid(),
        produccion: z.number().positive(),
      })
      .parse(req.body);
    if (origenId === destinoId) return res.status(400).json({ error: 'Origen y destino deben ser distintos.' });

    const sucursalId = req.user!.sucursalId;
    const usuarioId = req.user!.sub;
    const [origen, destino] = await Promise.all([
      prisma.insumo.findFirst({ where: { id: origenId, sucursalId } }),
      prisma.insumo.findFirst({ where: { id: destinoId, sucursalId } }),
    ]);
    if (!origen || !destino) return res.status(400).json({ error: 'Insumo inválido.' });

    const costoOrigen = Number(origen.costoPromedio);
    const costoProducido = produccion > 0 ? (consumo * costoOrigen) / produccion : 0;

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT registrar_movimiento_inventario(${origenId}::uuid, ${sucursalId}::uuid, 'Salida', ${-consumo}::numeric, ${costoOrigen}::numeric, 'Reproceso: salida', ${usuarioId}::uuid, NULL, NULL, NULL)`;
      await tx.$queryRaw`SELECT registrar_movimiento_inventario(${destinoId}::uuid, ${sucursalId}::uuid, 'Entrada', ${produccion}::numeric, ${costoProducido}::numeric, 'Reproceso: entrada', ${usuarioId}::uuid, NULL, NULL, NULL)`;
    });

    res.status(201).json({ ok: true });
  }),
);
