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

const tiposInsumo = ['materia_prima', 'elaborado', 'terminado'] as const;
const crearInsumoSchema = z.object({
  nombre: z.string().min(1).max(120),
  categoria: z.string().max(60).optional(),
  tipo: z.enum(tiposInsumo).optional(),
  unidad: z.string().min(1).max(10),
  existencia: z.number().nonnegative().optional(),
  minimo: z.number().nonnegative().optional(),
  costoUnitario: z.number().nonnegative().optional(),
});
const editarInsumoSchema = crearInsumoSchema.partial();

/** Unidad de medida por abreviatura; la crea (tipo Unidad) si no existe. */
async function unidadMedidaId(abreviatura: string): Promise<string> {
  const u = await prisma.unidadMedida.findUnique({ where: { abreviatura } });
  return (u ?? (await prisma.unidadMedida.create({ data: { nombre: abreviatura, abreviatura, tipo: 'Unidad' } }))).id;
}

/** POST /insumos — alta de insumo con su existencia inicial. */
inventarioRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearInsumoSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const insumo = await prisma.insumo.create({
      data: {
        sucursalId,
        unidadMedidaId: await unidadMedidaId(d.unidad),
        nombre: d.nombre,
        categoria: d.categoria || null,
        tipo: d.tipo ?? 'materia_prima',
        costoPromedio: d.costoUnitario ?? 0,
        stockMinimo: d.minimo ?? 0,
        existencia: { create: { sucursalId, cantidad: d.existencia ?? 0 } },
      },
    });
    res.status(201).json({ id: insumo.id });
  }),
);

/** PATCH /insumos/:id — edita datos maestros; los cambios de existencia se registran como Ajuste. */
inventarioRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarInsumoSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const insumo = await prisma.insumo.findFirst({
      where: { id: req.params.id, sucursalId, deletedAt: null },
      include: { existencia: true },
    });
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

    await prisma.insumo.update({
      where: { id: insumo.id },
      data: {
        nombre: d.nombre,
        categoria: d.categoria !== undefined ? d.categoria || null : undefined,
        tipo: d.tipo,
        costoPromedio: d.costoUnitario,
        stockMinimo: d.minimo,
        ...(d.unidad ? { unidadMedidaId: await unidadMedidaId(d.unidad) } : {}),
      },
    });

    if (d.existencia !== undefined) {
      const actual = Number(insumo.existencia?.cantidad ?? 0);
      const delta = d.existencia - actual;
      if (Math.abs(delta) > 1e-9) {
        const costo = d.costoUnitario ?? Number(insumo.costoPromedio);
        await prisma.$queryRaw`SELECT registrar_movimiento_inventario(${insumo.id}::uuid, ${sucursalId}::uuid, 'Ajuste', ${delta}::numeric, ${costo}::numeric, 'Ajuste manual (catálogo)', ${req.user!.sub}::uuid, NULL, NULL, NULL)`;
      }
    }
    res.json({ ok: true });
  }),
);

/** DELETE /insumos/:id — borrado lógico. */
inventarioRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const insumo = await prisma.insumo.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });
    await prisma.insumo.update({ where: { id: insumo.id }, data: { deletedAt: new Date(), activo: false } });
    res.status(204).send();
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
