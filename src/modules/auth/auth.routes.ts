import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { verifyPassword, hashPassword } from '../../lib/password.js';
import { firmarToken } from '../../lib/jwt.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

/** Hash del token de restablecimiento (nunca se guarda el token en claro). */
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
/** Oculta parte del número para no exponerlo completo en pantalla. */
const enmascararTel = (tel: string) => tel.replace(/\d(?=\d{2})/g, '•');

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
        nombre: usuario.nombre ?? usuario.empleado?.nombre ?? usuario.email,
        sucursalId: usuario.sucursalId,
        roles,
      },
    });
  }),
);

/**
 * POST /auth/recuperar — genera un token de restablecimiento y arma el mensaje
 * de WhatsApp. No revela si el correo existe; solo devuelve el enlace wa.me
 * (hacia el número registrado) cuando hay una cuenta con teléfono.
 */
authRouter.post(
  '/recuperar',
  ah(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Respuesta genérica si no hay cuenta activa o no tiene teléfono registrado.
    if (!usuario || !usuario.activo || usuario.deletedAt || !usuario.telefono) {
      return res.json({
        ok: true,
        enviado: false,
        mensaje: 'Si el correo está registrado y tiene un teléfono, podrás enviarte el enlace por WhatsApp.',
      });
    }

    const token = randomBytes(32).toString('hex');
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { resetToken: hashToken(token), resetTokenExp: new Date(Date.now() + 30 * 60 * 1000) }, // 30 min
    });

    const resetUrl = `${env.FRONTEND_URL}/restablecer?token=${token}`;
    const texto = `GOPIC · Restablece tu contraseña. Abre este enlace (vence en 30 min): ${resetUrl}`;
    const numero = usuario.telefono.replace(/\D/g, '');
    const waLink = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    res.json({ ok: true, enviado: true, telefono: enmascararTel(usuario.telefono), waLink, resetUrl });
  }),
);

/** POST /auth/restablecer — valida el token y fija la nueva contraseña. */
authRouter.post(
  '/restablecer',
  ah(async (req, res) => {
    const { token, password } = z
      .object({ token: z.string().min(1), password: z.string().min(6).max(100) })
      .parse(req.body);

    const usuario = await prisma.usuario.findFirst({
      where: { resetToken: hashToken(token), resetTokenExp: { gt: new Date() }, deletedAt: null },
    });
    if (!usuario) return res.status(400).json({ error: 'El enlace es inválido o ya venció.' });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: hashPassword(password), resetToken: null, resetTokenExp: null, intentosFallidos: 0 },
    });
    res.json({ ok: true });
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
