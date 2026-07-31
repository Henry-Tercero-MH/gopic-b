import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const ventasRouter = Router();
ventasRouter.use(requireAuth);

const modSchema = z.object({
  opcion_modificador_id: z.string().uuid().nullable().optional(),
  nombre: z.string(),
  precio_extra: z.number().nonnegative(),
});
const itemSchema = z.object({
  producto_id: z.string().uuid(),
  descripcion: z.string().min(1),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().nonnegative(),
  impuesto_tasa: z.number().nonnegative().default(12),
  es_cortesia: z.boolean().default(false),
  comanda_detalle_id: z.string().uuid().nullable().optional(),
  modificadores: z.array(modSchema).optional(),
});
const pagoSchema = z.object({
  forma_pago_id: z.string().uuid(),
  monto: z.number().positive(),
  recibido: z.number().nonnegative().nullable().optional(),
  referencia: z.string().nullable().optional(),
});
const ventaSchema = z.object({
  tipoVenta: z.enum(['mesa', 'mostrador', 'llevar']),
  serie: z.string().min(1).max(10).default('A'),
  items: z.array(itemSchema).min(1),
  pagos: z.array(pagoSchema).min(1),
  cuentaId: z.string().uuid().nullable().optional(),
  clienteId: z.string().uuid().nullable().optional(),
  recompensaId: z.string().uuid().nullable().optional(),
  descuento: z.number().nonnegative().default(0),
  promociones: z
    .array(z.object({ promocion_id: z.string().uuid(), descuento_aplicado: z.number().nonnegative() }))
    .optional(),
});

/**
 * POST /ventas — venta POS completa y atómica (llama a la función registrar_venta).
 * Requiere una caja abierta del usuario. Devuelve { factura_id, folio, total, puntos_ganados, ... }.
 */
ventasRouter.post(
  '/',
  ah(async (req, res) => {
    const v = ventaSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    const caja = await prisma.cajaSesion.findFirst({
      where: { sucursalId, usuarioId: req.user!.sub, estado: 'abierta' },
    });
    if (!caja) return res.status(400).json({ error: 'Abre la caja antes de cobrar' });

    const items = JSON.stringify(v.items);
    const pagos = JSON.stringify(v.pagos);
    const promos = JSON.stringify(v.promociones ?? []);

    // Venta + (si aplica) canje de recompensa, atómico en una sola transacción.
    const resultado = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ registrar_venta: { factura_id: string } }[]>`
        SELECT registrar_venta(
          ${sucursalId}::uuid,
          ${caja.id}::uuid,
          ${req.user!.sub}::uuid,
          ${v.serie},
          ${v.tipoVenta},
          ${items}::jsonb,
          ${pagos}::jsonb,
          ${v.cuentaId ?? null}::uuid,
          ${v.clienteId ?? null}::uuid,
          ${v.descuento}::numeric,
          ${promos}::jsonb
        ) AS registrar_venta`;
      const venta = rows[0]?.registrar_venta;

      if (v.clienteId && v.recompensaId && venta) {
        await tx.$queryRaw`SELECT canjear_recompensa(${v.clienteId}::uuid, ${v.recompensaId}::uuid, ${venta.factura_id}::uuid)`;
      }

      // Al cobrar una cuenta (servicio en mesa): ciérrala y libera la mesa.
      if (v.cuentaId) {
        const cuenta = await tx.cuenta.update({
          where: { id: v.cuentaId },
          data: { estado: 'cobrada' },
          select: { mesaId: true },
        });
        if (cuenta.mesaId) await tx.mesa.update({ where: { id: cuenta.mesaId }, data: { estado: 'libre' } });
      }
      return venta;
    });

    res.status(201).json(resultado ?? null);
  }),
);

/** GET /ventas/:id — factura emitida con sus detalles. */
ventasRouter.get(
  '/:id',
  ah(async (req, res) => {
    const factura = await prisma.factura.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId },
      include: {
        detalles: { include: { modificadores: true } },
        pagos: true,
        cliente: { select: { nombre: true } },
      },
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(factura);
  }),
);
