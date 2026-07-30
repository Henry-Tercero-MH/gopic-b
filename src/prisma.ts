import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma como singleton. En desarrollo se reutiliza entre recargas de
 * `tsx watch` para no abrir conexiones de más.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
