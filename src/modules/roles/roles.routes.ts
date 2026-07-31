import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

/** GET /roles/catalogo — permisos disponibles, agrupados por módulo. */
rolesRouter.get(
  '/catalogo',
  ah(async (_req, res) => {
    const permisos = await prisma.permiso.findMany({ orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }] });
    const grupos = new Map<string, { codigo: string; descripcion: string }[]>();
    for (const p of permisos) {
      const arr = grupos.get(p.modulo) ?? [];
      arr.push({ codigo: p.codigo, descripcion: p.descripcion });
      grupos.set(p.modulo, arr);
    }
    res.json([...grupos.entries()].map(([modulo, permisos]) => ({ modulo, permisos })));
  }),
);

/** GET /roles — roles de la sucursal con sus permisos y nº de usuarios. */
rolesRouter.get(
  '/',
  ah(async (req, res) => {
    const roles = await prisma.rol.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: {
        permisos: { include: { permiso: { select: { codigo: true } } } },
        _count: { select: { usuarios: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      roles.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        esSistema: r.esSistema,
        permisos: r.permisos.map((rp) => rp.permiso.codigo),
        usuarios: r._count.usuarios,
      })),
    );
  }),
);

const crearSchema = z.object({
  nombre: z.string().min(1).max(60),
  descripcion: z.string().max(200).optional(),
  permisos: z.array(z.string()).default([]),
});
const editarSchema = crearSchema.partial();

/** Resuelve códigos de permiso a sus ids (ignora los desconocidos). */
async function idsDePermisos(codigos: string[]): Promise<string[]> {
  if (codigos.length === 0) return [];
  const permisos = await prisma.permiso.findMany({ where: { codigo: { in: codigos } }, select: { id: true } });
  return permisos.map((p) => p.id);
}

rolesRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const permisoIds = await idsDePermisos(d.permisos);
    const rol = await prisma.rol.create({
      data: {
        sucursalId: req.user!.sucursalId,
        nombre: d.nombre,
        descripcion: d.descripcion ?? '',
        permisos: { create: permisoIds.map((permisoId) => ({ permisoId })) },
      },
    });
    res.status(201).json({ id: rol.id });
  }),
);

rolesRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const rol = await prisma.rol.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });

    await prisma.$transaction(async (tx) => {
      await tx.rol.update({
        where: { id: rol.id },
        data: {
          // El nombre de un rol de sistema no se puede cambiar; sus permisos sí.
          nombre: d.nombre && !rol.esSistema ? d.nombre : undefined,
          descripcion: d.descripcion,
        },
      });
      if (d.permisos) {
        const permisoIds = await idsDePermisos(d.permisos);
        await tx.rolPermiso.deleteMany({ where: { rolId: rol.id } });
        await tx.rolPermiso.createMany({ data: permisoIds.map((permisoId) => ({ rolId: rol.id, permisoId })) });
      }
    });
    res.json({ ok: true });
  }),
);

rolesRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const rol = await prisma.rol.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    if (rol.esSistema) return res.status(409).json({ error: 'No se puede eliminar un rol del sistema' });
    if (rol._count.usuarios > 0) return res.status(409).json({ error: 'El rol tiene usuarios asignados' });
    await prisma.rol.update({ where: { id: rol.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  }),
);
