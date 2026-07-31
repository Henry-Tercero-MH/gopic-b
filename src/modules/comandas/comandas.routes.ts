import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const comandasRouter = Router();
comandasRouter.use(requireAuth);

const ACTIVAS = ['pendiente', 'preparacion', 'listo'] as const;

const crearSchema = z.object({
  tipoVenta: z.enum(['mesa', 'mostrador', 'llevar']),
  mesaId: z.string().uuid().optional(),
  origen: z.string().max(40).optional(),
  items: z
    .array(z.object({ productoId: z.string().uuid(), cantidad: z.number().int().positive(), nota: z.string().max(200).optional() }))
    .min(1),
});

/** Folio corto de comanda, único dentro de la cuenta. */
const folio = (estacion: string) => `${estacion.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`;

/** POST /comandas — envía a cocina: crea la cuenta y una comanda por estación. */
comandasRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    // Estación y validez de cada producto (deben ser de la sucursal).
    const ids = [...new Set(d.items.map((i) => i.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: ids }, sucursalId },
      select: { id: true, estacion: true },
    });
    const estacionDe = new Map(productos.map((p) => [p.id, p.estacion]));
    if (d.items.some((i) => !estacionDe.has(i.productoId))) {
      return res.status(400).json({ error: 'Algún producto no pertenece a la sucursal.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // En mesa se acumulan rondas: reutiliza la cuenta abierta o crea una nueva.
      let cuenta =
        d.tipoVenta === 'mesa' && d.mesaId
          ? await tx.cuenta.findFirst({ where: { mesaId: d.mesaId, sucursalId, estado: 'abierta' } })
          : null;
      if (!cuenta) {
        cuenta = await tx.cuenta.create({
          data: {
            sucursalId,
            mesaId: d.tipoVenta === 'mesa' ? d.mesaId : null,
            tipoVenta: d.tipoVenta,
            estado: 'abierta',
          },
        });
      }
      // Al enviar a cocina, la mesa queda ocupada.
      if (d.tipoVenta === 'mesa' && d.mesaId) {
        await tx.mesa.update({ where: { id: d.mesaId }, data: { estado: 'ocupada' } });
      }

      // Agrupa los ítems por estación (Cocina / Barra) → una comanda por grupo.
      const porEstacion = new Map<string, typeof d.items>();
      for (const it of d.items) {
        const est = estacionDe.get(it.productoId)!;
        (porEstacion.get(est) ?? porEstacion.set(est, []).get(est)!).push(it);
      }

      const out = [];
      for (const [estacion, items] of porEstacion) {
        const comanda = await tx.comanda.create({
          data: {
            cuentaId: cuenta.id,
            folio: folio(estacion),
            estacion: estacion as 'Barra' | 'Cocina',
            estado: 'pendiente',
            origen: d.origen ?? (d.tipoVenta === 'llevar' ? 'Para llevar' : 'Mostrador'),
            detalles: {
              create: items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, nota: it.nota })),
            },
          },
        });
        out.push(comanda);
      }
      return { cuentaId: cuenta.id, comandas: out };
    });

    res.status(201).json(resultado);
  }),
);

/** GET /comandas — comandas activas (para el tablero KDS). */
comandasRouter.get(
  '/',
  ah(async (req, res) => {
    const comandas = await prisma.comanda.findMany({
      where: { cuenta: { sucursalId: req.user!.sucursalId }, estado: { in: [...ACTIVAS] } },
      include: { detalles: { include: { producto: { select: { nombre: true } } } } },
      orderBy: { creadaEn: 'asc' },
    });
    res.json(
      comandas.map((c) => ({
        id: c.id,
        folio: c.folio,
        estacion: c.estacion,
        estado: c.estado,
        origen: c.origen,
        creadaEn: c.creadaEn,
        items: c.detalles.map((dd) => ({ nombre: dd.producto.nombre, cantidad: dd.cantidad, nota: dd.nota })),
      })),
    );
  }),
);

/** GET /comandas/historial — últimas comandas entregadas (para el KDS). */
comandasRouter.get(
  '/historial',
  ah(async (req, res) => {
    const comandas = await prisma.comanda.findMany({
      where: { cuenta: { sucursalId: req.user!.sucursalId }, estado: 'entregada' },
      include: { detalles: { include: { producto: { select: { nombre: true } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json(
      comandas.map((c) => ({
        id: c.id,
        folio: c.folio,
        estacion: c.estacion,
        estado: c.estado,
        origen: c.origen,
        creadaEn: c.creadaEn,
        entregadaEn: c.updatedAt,
        items: c.detalles.map((dd) => ({ nombre: dd.producto.nombre, cantidad: dd.cantidad, nota: dd.nota })),
      })),
    );
  }),
);

/** PATCH /comandas/:id — cambia el estado (avanzar / entregar). */
comandasRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const { estado } = z
      .object({ estado: z.enum(['pendiente', 'preparacion', 'listo', 'entregada']) })
      .parse(req.body);

    const existe = await prisma.comanda.findFirst({
      where: { id: req.params.id, cuenta: { sucursalId: req.user!.sucursalId } },
    });
    if (!existe) return res.status(404).json({ error: 'Comanda no encontrada' });

    const comanda = await prisma.comanda.update({
      where: { id: req.params.id },
      data: { estado, listaEn: estado === 'listo' ? new Date() : existe.listaEn },
    });
    res.json(comanda);
  }),
);
