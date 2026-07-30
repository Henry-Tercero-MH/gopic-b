import 'dotenv/config';
import { z } from 'zod';

/** Valida y tipa las variables de entorno al arrancar; falla temprano si falta algo. */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('dev-secret-cambia-esto-en-produccion'),
  JWT_EXPIRES: z.string().default('8h'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
/** Orígenes CORS permitidos (coma-separados en la variable). */
export const corsOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
