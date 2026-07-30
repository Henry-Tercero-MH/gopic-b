# GOPIC — Backend (API)

API del sistema POS/ERP **GOPIC**. Node + Express + TypeScript + **Prisma** sobre **PostgreSQL**.
Repo **independiente** del frontend: este se despliega en **Railway**; el frontend (`gopic/`) en **Vercel**.

El modelo de datos deriva de `../gopic/docs/modelo-entidad-relacion.md` (v4.0, 3FN).
Este primer paso implementa el **núcleo** (32 tablas); el módulo de pedidos en línea y las
funciones PL/pgSQL se agregan después.

## Requisitos
- Node 20+
- Docker (para Postgres local)

## Puesta en marcha (local)

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar Postgres (y Adminer en http://localhost:8080)
npm run docker:up

# 3. Copiar variables de entorno
cp .env.example .env      # ya viene apuntando al Postgres del compose (puerto 5433)

# 4. Crear la base y aplicar el schema (primera migración)
npm run prisma:migrate    # nombre sugerido: "init_nucleo"

# 5. Arrancar la API en desarrollo
npm run dev               # http://localhost:4000/health
```

## Scripts
| Script | Qué hace |
|--------|----------|
| `npm run dev` | API con recarga (tsx watch) |
| `npm run build` / `start` | Compila TS / corre el build |
| `npm run prisma:migrate` | Crea/aplica migración en desarrollo |
| `npm run prisma:deploy` | Aplica migraciones (producción/Railway) |
| `npm run prisma:studio` | Explorador visual de datos |
| `npm run db:seed` | Carga datos de ejemplo (pendiente) |
| `npm run docker:up` / `docker:down` | Postgres local |

## Despliegue en Railway
1. Crea un proyecto y añade el plugin **PostgreSQL** (genera `DATABASE_URL`).
2. Conecta este repo; Railway construye con el `Dockerfile`.
3. Variables: `DATABASE_URL` (la del plugin), `PORT` (Railway la inyecta), `CORS_ORIGIN` (URL de Vercel).
4. El contenedor corre `prisma migrate deploy` y arranca la API.

## Constraints y funciones (SQL que Prisma no expresa)

Prisma modela tablas/relaciones/enums; el resto del modelo ER vive en SQL versionado:

- `prisma/sql/01_constraints.sql` — CHECKs, columnas `GENERATED`, índices únicos
  **parciales**, `EXCLUDE` de reservaciones, `CITEXT` en emails, extensiones.
- `prisma/sql/02_functions.sql` — trigger `set_updated_at` + funciones PL/pgSQL
  (`siguiente_folio`, `registrar_movimiento_inventario`, `explotar_receta`,
  `acumular_puntos`, `canjear_recompensa`, `registrar_venta`, `cancelar_factura`).

**Aplicarlo rápido en local** (con Postgres del compose corriendo):
```bash
npm run db:sql
```

**Modo canónico (plegarlo a una migración Prisma, para producción/Railway):**
```bash
npx prisma migrate dev --create-only --name constraints_y_funciones   # crea la carpeta vacía
cat prisma/sql/01_constraints.sql prisma/sql/02_functions.sql \
  >> prisma/migrations/*_constraints_y_funciones/migration.sql          # pega el SQL
npx prisma migrate dev                                                  # aplica
```
Así `prisma migrate deploy` (en el `Dockerfile`) lo aplica también en Railway.

> ⚠ Las funciones son la traducción de §10 del ER; **valídalas con datos** antes de producción.

### Contrato JSONB de `registrar_venta` (POS)
```jsonc
items = [{ "producto_id":"uuid","descripcion":"...","cantidad":2,"precio_unitario":45.00,
  "impuesto_tasa":12.00,"es_cortesia":false,"comanda_detalle_id":"uuid|null",
  "modificadores":[{"opcion_modificador_id":"uuid|null","nombre":"Extra queso","precio_extra":5.00}] }]
pagos = [{ "forma_pago_id":"uuid","monto":95.00,"recibido":100.00,"referencia":null }]
promociones = [{ "promocion_id":"uuid","descuento_aplicado":10.00 }]   // opcional
```

## API — endpoints disponibles

Autenticación con **JWT** (`Authorization: Bearer <token>`). El token lleva `sucursalId` y `roles`;
las consultas se filtran por la sucursal del usuario. Las mutaciones exigen rol **Administrador**.

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET  | `/health`, `/health/db` | público | vivo / conexión a DB |
| POST | `/auth/login` | público | `{ email, password }` → `{ token, usuario }` |
| GET  | `/auth/me` | auth | datos del token |
| GET  | `/productos` | auth | catálogo de la sucursal |
| GET  | `/productos/:id` | auth | un producto |
| POST | `/productos` | admin | crear |
| PATCH | `/productos/:id` | admin | editar |
| DELETE | `/productos/:id` | admin | borrado lógico |

**Prueba rápida** (con DB migrada + seed):
```bash
# login (admin del seed)
curl -s localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@gopic.gt","password":"admin123"}'
# usar el token
curl -s localhost:4000/productos -H "Authorization: Bearer <TOKEN>"
```

> El frontend consumirá esto con `VITE_API_URL` (p. ej. `https://<tu-app>.up.railway.app`).

## Estado
- ✅ Núcleo (32 tablas) en `prisma/schema.prisma`.
- ✅ Constraints + funciones PL/pgSQL en `prisma/sql/` (validar contra DB).
- ✅ API REST: `auth` (login/me) + `productos` (CRUD) con JWT y roles.
- ⏳ Más módulos REST (categorías, inventario, ventas → `registrar_venta`).
- ⏳ FK compuestas anti-cruce multi-sucursal · Módulo 17 (pedidos en línea).
