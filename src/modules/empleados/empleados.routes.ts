import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const empleadosRouter = Router();
empleadosRouter.use(requireAuth);

const TZ = 'America/Guatemala';
/** Fecha local (yyyy-mm-dd) en Guatemala, para saber qué marcaje es "de hoy". */
const gtDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
/** Hora HH:MM local en Guatemala, o null. */
const gtTime = (d: Date | null) =>
  d ? d.toLocaleTimeString('es-GT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : null;

const iniciales = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  puesto: z.string().min(1).max(60),
  telefono: z.string().max(30).optional(),
  turno: z.string().max(60).optional(),
});
const editarSchema = crearSchema.partial();

/** Puesto por nombre; lo crea (salario 0) si no existe. */
async function puestoId(nombre: string): Promise<string> {
  const p = await prisma.puesto.findFirst({ where: { nombre, deletedAt: null } });
  return (p ?? (await prisma.puesto.create({ data: { nombre, salarioBase: 0 } }))).id;
}

type MarcajeHoy = { estado: 'trabajando' | 'sin_marcar' | 'salio'; entrada: string | null; salida: string | null };

/** Deriva el estado de marcaje a partir del último marcaje del empleado. */
function estadoMarcaje(ultimo: { entrada: Date | null; salida: Date | null } | undefined): MarcajeHoy {
  const hoy = gtDate(new Date());
  if (ultimo?.entrada && gtDate(ultimo.entrada) === hoy) {
    return ultimo.salida
      ? { estado: 'salio', entrada: gtTime(ultimo.entrada), salida: gtTime(ultimo.salida) }
      : { estado: 'trabajando', entrada: gtTime(ultimo.entrada), salida: null };
  }
  return { estado: 'sin_marcar', entrada: null, salida: null };
}

/** GET /empleados — personal de la sucursal con su marcaje de hoy. */
empleadosRouter.get(
  '/',
  ah(async (req, res) => {
    const empleados = await prisma.empleado.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: {
        puesto: { select: { nombre: true } },
        marcajes: { orderBy: { entrada: 'desc' }, take: 1 },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(
      empleados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        iniciales: iniciales(e.nombre),
        puesto: e.puesto.nombre,
        telefono: e.telefono ?? '',
        turno: e.turno ?? '',
        ...estadoMarcaje(e.marcajes[0]),
      })),
    );
  }),
);

empleadosRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const emp = await prisma.empleado.create({
      data: {
        sucursalId: req.user!.sucursalId,
        puestoId: await puestoId(d.puesto),
        nombre: d.nombre,
        telefono: d.telefono || null,
        turno: d.turno || null,
        fechaIngreso: new Date(),
      },
    });
    res.status(201).json({ id: emp.id });
  }),
);

empleadosRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.empleado.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Empleado no encontrado' });

    await prisma.empleado.update({
      where: { id: req.params.id },
      data: {
        nombre: d.nombre,
        telefono: d.telefono !== undefined ? d.telefono || null : undefined,
        turno: d.turno !== undefined ? d.turno || null : undefined,
        ...(d.puesto ? { puestoId: await puestoId(d.puesto) } : {}),
      },
    });
    res.json({ ok: true });
  }),
);

empleadosRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.empleado.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!existe) return res.status(404).json({ error: 'Empleado no encontrado' });
    await prisma.empleado.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), activo: false } });
    res.status(204).send();
  }),
);

/** POST /empleados/:id/entrada — registra entrada (nuevo marcaje). */
empleadosRouter.post(
  '/:id/entrada',
  ah(async (req, res) => {
    const emp = await prisma.empleado.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { marcajes: { orderBy: { entrada: 'desc' }, take: 1 } },
    });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    const ult = emp.marcajes[0];
    if (ult?.entrada && gtDate(ult.entrada) === gtDate(new Date()) && !ult.salida) {
      return res.status(409).json({ error: 'El empleado ya está en turno' });
    }
    await prisma.marcaje.create({ data: { empleadoId: emp.id, entrada: new Date() } });
    res.status(201).json({ ok: true });
  }),
);

/** POST /empleados/:id/salida — cierra el marcaje abierto de hoy. */
empleadosRouter.post(
  '/:id/salida',
  ah(async (req, res) => {
    const emp = await prisma.empleado.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { marcajes: { orderBy: { entrada: 'desc' }, take: 1 } },
    });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    const abierto = emp.marcajes[0];
    if (!abierto?.entrada || abierto.salida || gtDate(abierto.entrada) !== gtDate(new Date())) {
      return res.status(400).json({ error: 'El empleado no tiene un turno abierto hoy' });
    }
    const salida = new Date();
    await prisma.marcaje.update({
      where: { id: abierto.id },
      data: { salida, minutosTrabajados: Math.max(0, Math.round((salida.getTime() - abierto.entrada.getTime()) / 60000)) },
    });
    res.json({ ok: true });
  }),
);
