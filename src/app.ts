import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { corsOrigins, env } from './env.js';
import { prisma } from './prisma.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productosRouter } from './modules/productos/productos.routes.js';
import { categoriasRouter } from './modules/categorias/categorias.routes.js';
import { cajaRouter } from './modules/caja/caja.routes.js';
import { ventasRouter } from './modules/ventas/ventas.routes.js';
import { pagosRouter } from './modules/pagos/pagos.routes.js';
import { clientesRouter } from './modules/clientes/clientes.routes.js';
import { recompensasRouter } from './modules/recompensas/recompensas.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { comandasRouter } from './modules/comandas/comandas.routes.js';
import { mesasRouter } from './modules/mesas/mesas.routes.js';
import { inventarioRouter } from './modules/inventario/inventario.routes.js';
import { gastosRouter } from './modules/gastos/gastos.routes.js';
import { empleadosRouter } from './modules/empleados/empleados.routes.js';
import { proveedoresRouter } from './modules/proveedores/proveedores.routes.js';
import { comprasRouter } from './modules/compras/compras.routes.js';
import { recetasRouter } from './modules/recetas/recetas.routes.js';
import { promocionesRouter } from './modules/promociones/promociones.routes.js';
import { sucursalRouter } from './modules/sucursal/sucursal.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { usuariosRouter } from './modules/usuarios/usuarios.routes.js';

// PostgreSQL BIGINT (p. ej. factura.folio) llega como BigInt: serialízalo como número en JSON.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as unknown as bigint);
};

export function crearApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Healthchecks (Railway los usa para saber si el servicio está vivo).
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'gopic-backend' }));
  app.get('/health/db', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/', (_req, res) =>
    res.json({ name: 'GOPIC API', version: '0.1.0', health: '/health' }),
  );

  // Módulos.
  app.use('/auth', authRouter);
  app.use('/productos', productosRouter);
  app.use('/categorias', categoriasRouter);
  app.use('/caja', cajaRouter);
  app.use('/ventas', ventasRouter);
  app.use('/formas-pago', pagosRouter);
  app.use('/clientes', clientesRouter);
  app.use('/recompensas', recompensasRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/comandas', comandasRouter);
  app.use('/mesas', mesasRouter);
  app.use('/insumos', inventarioRouter);
  app.use('/gastos', gastosRouter);
  app.use('/empleados', empleadosRouter);
  app.use('/proveedores', proveedoresRouter);
  app.use('/ordenes-compra', comprasRouter);
  app.use('/recetas', recetasRouter);
  app.use('/promociones', promocionesRouter);
  app.use('/sucursal', sucursalRouter);
  app.use('/roles', rolesRouter);
  app.use('/usuarios', usuariosRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejador de errores centralizado.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: err.flatten().fieldErrors });
    }
    console.error(err);
    const mensaje = err instanceof Error ? err.message : 'Error interno';
    res.status(500).json({ error: mensaje });
  });

  return app;
}
