import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const cajaRouter = Router();
cajaRouter.use(requireAuth);

const TZ = 'America/Guatemala';
const hhmm = (d: Date) => new Date(d).toLocaleTimeString('es-GT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** Sesión de caja abierta del usuario actual (o null). */
async function sesionAbierta(sucursalId: string, usuarioId: string) {
  return prisma.cajaSesion.findFirst({ where: { sucursalId, usuarioId, estado: 'abierta' } });
}

/** GET /caja/actual — sesión abierta con resumen del turno y movimientos. */
cajaRouter.get(
  '/actual',
  ah(async (req, res) => {
    const sesion = await sesionAbierta(req.user!.sucursalId, req.user!.sub);
    if (!sesion) return res.json({ abierta: false });

    const [facturas, movimientosManuales, usuario] = await Promise.all([
      prisma.factura.findMany({
        where: { cajaSesionId: sesion.id, estado: 'emitida' },
        select: {
          id: true, folio: true, serie: true, total: true, tipoVenta: true, emitidaEn: true,
          pagos: { select: { monto: true, formaPago: { select: { nombre: true } } } },
        },
        orderBy: { emitidaEn: 'asc' },
      }),
      prisma.cajaMovimiento.findMany({ where: { cajaSesionId: sesion.id }, orderBy: { registradoEn: 'asc' } }),
      prisma.usuario.findUnique({ where: { id: sesion.usuarioId }, include: { empleado: { select: { nombre: true } } } }),
    ]);

    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    for (const f of facturas) {
      for (const p of f.pagos) {
        if (p.formaPago.nombre === 'Efectivo') ventasEfectivo += Number(p.monto);
        else ventasTarjeta += Number(p.monto);
      }
    }
    const totalVentas = facturas.reduce((s, f) => s + Number(f.total), 0);
    const ingresos = movimientosManuales.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + Number(m.monto), 0);
    const retiros = movimientosManuales.filter((m) => m.tipo === 'Retiro').reduce((s, m) => s + Number(m.monto), 0);
    const fondo = Number(sesion.fondoApertura);
    const efectivoEsperado = fondo + ventasEfectivo + ingresos - retiros;

    const tipoLabel = (t: string) => (t === 'mesa' ? '' : t === 'llevar' ? ' · Para llevar' : ' · Mostrador');
    const movimientos = [
      { id: 'apertura', hora: hhmm(sesion.abiertaEn), tipo: 'Apertura', concepto: 'Fondo de caja', metodo: null as string | null, monto: fondo },
      ...facturas.map((f) => ({
        id: f.id,
        hora: hhmm(f.emitidaEn),
        tipo: 'Venta',
        concepto: `Ticket ${f.serie}-${f.folio}${tipoLabel(f.tipoVenta)}`,
        metodo: f.pagos.some((p) => p.formaPago.nombre === 'Efectivo') ? 'Efectivo' : 'Tarjeta',
        monto: Number(f.total),
      })),
      ...movimientosManuales.map((m) => ({
        id: m.id,
        hora: hhmm(m.registradoEn),
        tipo: m.tipo,
        concepto: m.concepto,
        metodo: null as string | null,
        monto: Number(m.monto),
      })),
    ].sort((a, b) => a.hora.localeCompare(b.hora));

    res.json({
      abierta: true,
      sesion: { id: sesion.id, fondoApertura: fondo, abiertaEn: sesion.abiertaEn, cajero: usuario?.nombre ?? usuario?.empleado?.nombre ?? '—' },
      resumen: { totalVentas, ventasEfectivo, ventasTarjeta, ingresos, retiros, efectivoEsperado },
      movimientos,
    });
  }),
);

/** POST /caja/abrir — abre la caja del turno. Solo una por usuario a la vez. */
cajaRouter.post(
  '/abrir',
  ah(async (req, res) => {
    const { cajaId, fondoApertura } = z
      .object({ cajaId: z.string().uuid().optional(), fondoApertura: z.number().nonnegative() })
      .parse(req.body);

    if (await sesionAbierta(req.user!.sucursalId, req.user!.sub)) {
      return res.status(409).json({ error: 'Ya tienes una caja abierta' });
    }
    const sesion = await prisma.cajaSesion.create({
      data: { sucursalId: req.user!.sucursalId, usuarioId: req.user!.sub, cajaId, fondoApertura, estado: 'abierta' },
    });
    res.status(201).json(sesion);
  }),
);

/** POST /caja/movimiento — registra un ingreso o retiro de efectivo del turno. */
cajaRouter.post(
  '/movimiento',
  ah(async (req, res) => {
    const { tipo, concepto, monto } = z
      .object({ tipo: z.enum(['Ingreso', 'Retiro']), concepto: z.string().min(1).max(120), monto: z.number().positive() })
      .parse(req.body);
    const sesion = await sesionAbierta(req.user!.sucursalId, req.user!.sub);
    if (!sesion) return res.status(400).json({ error: 'No tienes una caja abierta' });
    const mov = await prisma.cajaMovimiento.create({ data: { cajaSesionId: sesion.id, tipo, concepto, monto } });
    res.status(201).json(mov);
  }),
);

/** POST /caja/cerrar — arqueo: calcula efectivo esperado y cierra la sesión. */
cajaRouter.post(
  '/cerrar',
  ah(async (req, res) => {
    const { efectivoContado } = z.object({ efectivoContado: z.number().nonnegative() }).parse(req.body);

    const sesion = await sesionAbierta(req.user!.sucursalId, req.user!.sub);
    if (!sesion) return res.status(400).json({ error: 'No tienes una caja abierta' });

    const [efectivo, movs] = await Promise.all([
      prisma.pago.aggregate({
        _sum: { monto: true },
        where: { factura: { cajaSesionId: sesion.id }, formaPago: { nombre: 'Efectivo' } },
      }),
      prisma.cajaMovimiento.findMany({ where: { cajaSesionId: sesion.id } }),
    ]);
    const ingresos = movs.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + Number(m.monto), 0);
    const retiros = movs.filter((m) => m.tipo === 'Retiro').reduce((s, m) => s + Number(m.monto), 0);
    const efectivoEsperado = Number(sesion.fondoApertura) + Number(efectivo._sum.monto ?? 0) + ingresos - retiros;

    const cerrada = await prisma.cajaSesion.update({
      where: { id: sesion.id },
      data: { estado: 'cerrada', cerradaEn: new Date(), efectivoEsperado, efectivoContado },
    });
    res.json({ ...cerrada, diferencia: efectivoContado - efectivoEsperado });
  }),
);
