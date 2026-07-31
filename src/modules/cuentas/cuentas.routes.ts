import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const cuentasRouter = Router();
cuentasRouter.use(requireAuth);

/** GET /cuentas/mesa/:mesaId — cuenta abierta de la mesa con sus ítems acumulados. */
cuentasRouter.get(
  '/mesa/:mesaId',
  ah(async (req, res) => {
    const cuenta = await prisma.cuenta.findFirst({
      where: { mesaId: req.params.mesaId, sucursalId: req.user!.sucursalId, estado: 'abierta' },
      include: {
        comandas: { include: { detalles: { include: { producto: { select: { nombre: true, precio: true } } } } } },
      },
    });
    if (!cuenta) return res.json(null);

    // Suma todas las líneas de todas las comandas de la cuenta, agrupadas por producto.
    const acum = new Map<string, { productoId: string; nombre: string; precio: number; cantidad: number }>();
    for (const c of cuenta.comandas) {
      for (const d of c.detalles) {
        const prev = acum.get(d.productoId);
        if (prev) prev.cantidad += d.cantidad;
        else acum.set(d.productoId, { productoId: d.productoId, nombre: d.producto.nombre, precio: Number(d.producto.precio), cantidad: d.cantidad });
      }
    }
    const lineas = [...acum.values()];
    res.json({
      id: cuenta.id,
      mesaId: cuenta.mesaId,
      estado: cuenta.estado,
      lineas,
      total: lineas.reduce((s, l) => s + l.precio * l.cantidad, 0),
    });
  }),
);

/** POST /cuentas/:id/pedir-cuenta — la mesa pide la cuenta (pasa a estado "cuenta"). */
cuentasRouter.post(
  '/:id/pedir-cuenta',
  ah(async (req, res) => {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, estado: 'abierta' },
    });
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (cuenta.mesaId) await prisma.mesa.update({ where: { id: cuenta.mesaId }, data: { estado: 'cuenta' } });
    res.json({ ok: true });
  }),
);
