import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const cajaRouter = Router();
cajaRouter.use(requireAuth);

/** Sesión de caja abierta del usuario actual (o null). */
async function sesionAbierta(sucursalId: string, usuarioId: string) {
  return prisma.cajaSesion.findFirst({ where: { sucursalId, usuarioId, estado: 'abierta' } });
}

/** GET /caja/actual — sesión abierta + resumen de ventas del turno. */
cajaRouter.get(
  '/actual',
  ah(async (req, res) => {
    const sesion = await sesionAbierta(req.user!.sucursalId, req.user!.sub);
    if (!sesion) return res.json({ abierta: false });

    const [ventas, efectivo] = await Promise.all([
      prisma.factura.aggregate({ _count: true, _sum: { total: true }, where: { cajaSesionId: sesion.id, estado: 'emitida' } }),
      prisma.pago.aggregate({ _sum: { monto: true }, where: { factura: { cajaSesionId: sesion.id }, formaPago: { nombre: 'Efectivo' } } }),
    ]);
    res.json({
      abierta: true,
      sesion,
      resumen: {
        facturas: ventas._count,
        totalVendido: ventas._sum.total ?? 0,
        efectivoEsperado: Number(sesion.fondoApertura) + Number(efectivo._sum.monto ?? 0),
      },
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

/** POST /caja/cerrar — arqueo: calcula efectivo esperado y cierra la sesión. */
cajaRouter.post(
  '/cerrar',
  ah(async (req, res) => {
    const { efectivoContado } = z.object({ efectivoContado: z.number().nonnegative() }).parse(req.body);

    const sesion = await sesionAbierta(req.user!.sucursalId, req.user!.sub);
    if (!sesion) return res.status(400).json({ error: 'No tienes una caja abierta' });

    const efectivo = await prisma.pago.aggregate({
      _sum: { monto: true },
      where: { factura: { cajaSesionId: sesion.id }, formaPago: { nombre: 'Efectivo' } },
    });
    const efectivoEsperado = Number(sesion.fondoApertura) + Number(efectivo._sum.monto ?? 0);

    const cerrada = await prisma.cajaSesion.update({
      where: { id: sesion.id },
      data: { estado: 'cerrada', cerradaEn: new Date(), efectivoEsperado, efectivoContado },
    });
    res.json({ ...cerrada, diferencia: efectivoContado - efectivoEsperado });
  }),
);
