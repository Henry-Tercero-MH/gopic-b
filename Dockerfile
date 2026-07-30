# Imagen de producción para la API (Railway).
# Build multi-stage: compila TypeScript y genera el cliente Prisma, luego corre liviano.
FROM node:20-slim AS builder
WORKDIR /app

# openssl es requerido por Prisma.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 4000
# Aplica migraciones pendientes y arranca. Railway inyecta DATABASE_URL y PORT.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
