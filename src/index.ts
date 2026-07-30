import { crearApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = crearApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 GOPIC API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Apagado ordenado: cierra el servidor HTTP y la conexión a la base.
async function apagar(signal: string) {
  console.log(`\n${signal} recibido, cerrando…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
