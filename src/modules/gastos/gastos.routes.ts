import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const gastosRouter = Router();
gastosRouter.use(requireAuth);

const metodos = ['Efectivo', 'Transferencia', 'Tarjeta'] as const;
const estados = ['pagado', 'pendiente'] as const;

const crearSchema = z.object({
  concepto: z.string().min(1).max(160),
  categoria: z.string().min(1).max(60),
  proveedor: z.string().max(120).optional(),
  metodo: z.enum(metodos),
  estado: z.enum(estados),
  monto: z.number().positive(),
});
const editarSchema = crearSchema.partial();

const fmtFecha = (d: Date) => new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Categoría de gasto por nombre (global); la crea si no existe. */
async function categoriaGastoId(nombre: string): Promise<string> {
  const c = await prisma.categoriaGasto.findFirst({ where: { nombre } });
  return (c ?? (await prisma.categoriaGasto.create({ data: { nombre } }))).id;
}

/** Proveedor por nombre en la sucursal; lo crea si no existe. */
async function proveedorId(sucursalId: string, nombre: string): Promise<string> {
  const p = await prisma.proveedor.findFirst({ where: { sucursalId, nombre, deletedAt: null } });
  return (p ?? (await prisma.proveedor.create({ data: { sucursalId, nombre } }))).id;
}

/** GET /gastos — egresos de la sucursal. */
gastosRouter.get(
  '/',
  ah(async (req, res) => {
    const gastos = await prisma.gasto.findMany({
      where: { sucursalId: req.user!.sucursalId },
      include: { categoriaGasto: { select: { nombre: true } }, proveedor: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    });
    res.json(
      gastos.map((g) => ({
        id: g.id,
        fecha: fmtFecha(g.fecha),
        concepto: g.concepto,
        categoria: g.categoriaGasto.nombre,
        proveedor: g.proveedor?.nombre ?? '—',
        metodo: g.metodo,
        estado: g.estado,
        monto: Number(g.monto),
      })),
    );
  }),
);

gastosRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const gasto = await prisma.gasto.create({
      data: {
        sucursalId,
        usuarioId: req.user!.sub,
        categoriaGastoId: await categoriaGastoId(d.categoria),
        proveedorId: d.proveedor && d.proveedor !== '—' ? await proveedorId(sucursalId, d.proveedor) : null,
        concepto: d.concepto,
        metodo: d.metodo,
        estado: d.estado,
        monto: d.monto,
      },
    });
    res.status(201).json({ id: gasto.id });
  }),
);

gastosRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const existe = await prisma.gasto.findFirst({ where: { id: req.params.id, sucursalId } });
    if (!existe) return res.status(404).json({ error: 'Gasto no encontrado' });

    await prisma.gasto.update({
      where: { id: req.params.id },
      data: {
        concepto: d.concepto,
        metodo: d.metodo,
        estado: d.estado,
        monto: d.monto,
        ...(d.categoria ? { categoriaGastoId: await categoriaGastoId(d.categoria) } : {}),
        ...(d.proveedor !== undefined
          ? { proveedorId: d.proveedor && d.proveedor !== '—' ? await proveedorId(sucursalId, d.proveedor) : null }
          : {}),
      },
    });
    res.json({ ok: true });
  }),
);

gastosRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.gasto.findFirst({ where: { id: req.params.id, sucursalId: req.user!.sucursalId } });
    if (!existe) return res.status(404).json({ error: 'Gasto no encontrado' });
    await prisma.gasto.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
