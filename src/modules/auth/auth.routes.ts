import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { firmarToken } from '../../lib/jwt.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /auth/login — valida credenciales y devuelve un JWT. */
authRouter.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { empleado: true, roles: { include: { rol: true } } },
    });

    if (!usuario || !usuario.activo || !verifyPassword(password, usuario.passwordHash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const roles = usuario.roles.map((ur) => ur.rol.nombre);
    const token = firmarToken({ sub: usuario.id, sucursalId: usuario.sucursalId, roles });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.empleado?.nombre ?? usuario.email,
        sucursalId: usuario.sucursalId,
        roles,
      },
    });
  }),
);

/** GET /auth/me — datos del token actual (sirve para validar sesión en el front). */
authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    res.json({ user: req.user });
  }),
);
