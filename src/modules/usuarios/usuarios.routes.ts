import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { hashPassword } from '../../lib/password.js';

export const usuariosRouter = Router();
usuariosRouter.use(requireAuth);

/** GET /usuarios — cuentas de acceso de la sucursal. */
usuariosRouter.get(
  '/',
  ah(async (req, res) => {
    const usuarios = await prisma.usuario.findMany({
      where: { sucursalId: req.user!.sucursalId, deletedAt: null },
      include: {
        roles: { include: { rol: { select: { id: true, nombre: true } } } },
        empleado: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre ?? u.empleado?.nombre ?? u.email,
        email: u.email,
        telefono: u.telefono ?? '',
        activo: u.activo,
        rolId: u.roles[0]?.rol.id ?? null,
        rol: u.roles[0]?.rol.nombre ?? '—',
      })),
    );
  }),
);

const crearSchema = z.object({
  nombre: z.string().min(1).max(120),
  email: z.string().email().max(160),
  telefono: z.string().max(30).optional(),
  password: z.string().min(6).max(100),
  rolId: z.string().uuid(),
});

usuariosRouter.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;

    const existe = await prisma.usuario.findUnique({ where: { email: d.email } });
    if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

    const rol = await prisma.rol.findFirst({ where: { id: d.rolId, sucursalId, deletedAt: null } });
    if (!rol) return res.status(400).json({ error: 'Rol inválido' });

    const usuario = await prisma.usuario.create({
      data: {
        sucursalId,
        nombre: d.nombre,
        telefono: d.telefono || null,
        email: d.email,
        passwordHash: hashPassword(d.password),
        roles: { create: { rolId: d.rolId } },
      },
    });
    res.status(201).json({ id: usuario.id });
  }),
);

const editarSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  telefono: z.string().max(30).optional(),
  activo: z.boolean().optional(),
  rolId: z.string().uuid().optional(),
  password: z.string().min(6).max(100).optional(),
});

usuariosRouter.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const sucursalId = req.user!.sucursalId;
    const usuario = await prisma.usuario.findFirst({ where: { id: req.params.id, sucursalId, deletedAt: null } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (d.rolId) {
      const rol = await prisma.rol.findFirst({ where: { id: d.rolId, sucursalId, deletedAt: null } });
      if (!rol) return res.status(400).json({ error: 'Rol inválido' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          nombre: d.nombre,
          telefono: d.telefono !== undefined ? d.telefono || null : undefined,
          activo: d.activo,
          ...(d.password ? { passwordHash: hashPassword(d.password) } : {}),
        },
      });
      if (d.rolId) {
        await tx.usuarioRol.deleteMany({ where: { usuarioId: usuario.id } });
        await tx.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: d.rolId } });
      }
    });
    res.json({ ok: true });
  }),
);

usuariosRouter.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    if (req.params.id === req.user!.sub) {
      return res.status(409).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.params.id, sucursalId: req.user!.sucursalId, deletedAt: null },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Al eliminar la cuenta se liberan sus roles (no debe seguir contando en ellos).
    await prisma.$transaction([
      prisma.usuarioRol.deleteMany({ where: { usuarioId: usuario.id } }),
      prisma.usuario.update({ where: { id: usuario.id }, data: { deletedAt: new Date(), activo: false } }),
    ]);
    res.status(204).send();
  }),
);
