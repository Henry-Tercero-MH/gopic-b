-- CreateEnum
CREATE TYPE "Estacion" AS ENUM ('Barra', 'Cocina');

-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('mesa', 'mostrador', 'llevar');

-- CreateEnum
CREATE TYPE "TipoVentaDoc" AS ENUM ('mesa', 'mostrador', 'llevar', 'delivery', 'pickup');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('abierta', 'cobrada', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoComanda" AS ENUM ('pendiente', 'preparacion', 'listo', 'entregada');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('libre', 'ocupada', 'cuenta', 'reservada');

-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('materia_prima', 'elaborado', 'terminado');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('Peso', 'Volumen', 'Unidad');

-- CreateEnum
CREATE TYPE "TipoMovInv" AS ENUM ('Entrada', 'Salida', 'Ajuste', 'Merma');

-- CreateEnum
CREATE TYPE "EstadoConteo" AS ENUM ('borrador', 'aplicado');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('borrador', 'enviada', 'recibida', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoReservacion" AS ENUM ('confirmada', 'cumplida', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('emitida', 'cancelada');

-- CreateEnum
CREATE TYPE "OrigenFactura" AS ENUM ('pos', 'online');

-- CreateEnum
CREATE TYPE "TipoPromo" AS ENUM ('porcentaje', 'monto', '2x1', 'combo');

-- CreateEnum
CREATE TYPE "EstadoCajaSesion" AS ENUM ('abierta', 'cerrada');

-- CreateEnum
CREATE TYPE "TipoCajaMov" AS ENUM ('Apertura', 'Ingreso', 'Retiro');

-- CreateEnum
CREATE TYPE "TipoRecompensa" AS ENUM ('producto', 'descuento_monto', 'descuento_pct');

-- CreateEnum
CREATE TYPE "TipoMovLealtad" AS ENUM ('acumula', 'canjea');

-- CreateEnum
CREATE TYPE "MetodoGasto" AS ENUM ('Efectivo', 'Transferencia', 'Tarjeta');

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('pagado', 'pendiente');

-- CreateEnum
CREATE TYPE "AccionBitacora" AS ENUM ('crear', 'editar', 'eliminar', 'cancelar');

-- CreateTable
CREATE TABLE "sucursal" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "direccion" VARCHAR(200) NOT NULL,
    "telefono" VARCHAR(30) NOT NULL,
    "moneda" CHAR(3) NOT NULL DEFAULT 'GTQ',
    "logo_drive_id" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "empleado_id" UUID,
    "sucursal_id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "sucursal_id" UUID NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidad_id" UUID NOT NULL,
    "accion" "AccionBitacora" NOT NULL,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puesto" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "salario_base" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(30),
    "email" VARCHAR(160),
    "fecha_ingreso" DATE NOT NULL,
    "foto_drive_id" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fin" TIME(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marcaje" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "turno_id" UUID,
    "entrada" TIMESTAMPTZ(6),
    "salida" TIMESTAMPTZ(6),
    "minutos_trabajados" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marcaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "icono" VARCHAR(40),
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "precio" DECIMAL(12,4) NOT NULL,
    "imagen_drive_id" VARCHAR(100),
    "imagen_url" VARCHAR(500),
    "estacion" "Estacion" NOT NULL,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_modificador" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "requerido" BOOLEAN NOT NULL,
    "multiple" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "grupo_modificador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcion_modificador" (
    "id" UUID NOT NULL,
    "grupo_modificador_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "precio_extra" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "opcion_modificador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_grupo_modificador" (
    "producto_id" UUID NOT NULL,
    "grupo_modificador_id" UUID NOT NULL,

    CONSTRAINT "producto_grupo_modificador_pkey" PRIMARY KEY ("producto_id","grupo_modificador_id")
);

-- CreateTable
CREATE TABLE "receta" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "rendimiento" DECIMAL(12,4) NOT NULL,
    "costo_calculado" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_detalle" (
    "id" UUID NOT NULL,
    "receta_id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "merma_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receta_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad_medida" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "abreviatura" VARCHAR(10) NOT NULL,
    "tipo" "TipoUnidad" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidad_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "unidad_medida_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(60),
    "tipo" "TipoInsumo" NOT NULL,
    "costo_promedio" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "punto_reorden" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "existencia" (
    "id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "existencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo" "TipoMovInv" NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "saldo" DECIMAL(12,4) NOT NULL,
    "costo_unitario" DECIMAL(12,4) NOT NULL,
    "motivo" VARCHAR(120),
    "orden_compra_id" UUID,
    "factura_id" UUID,
    "conteo_fisico_id" UUID,
    "usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteo_fisico" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoConteo" NOT NULL DEFAULT 'borrador',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conteo_fisico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteo_detalle" (
    "id" UUID NOT NULL,
    "conteo_fisico_id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "cantidad_teorica" DECIMAL(12,4) NOT NULL,
    "cantidad_fisica" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "conteo_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "contacto" VARCHAR(120),
    "telefono" VARCHAR(30),
    "email" VARCHAR(160),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "folio" VARCHAR(20) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'borrador',
    "total" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orden_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_detalle" (
    "id" UUID NOT NULL,
    "orden_compra_id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "costo_unitario" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "orden_compra_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zona" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa" (
    "id" UUID NOT NULL,
    "zona_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "capacidad" SMALLINT NOT NULL,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'libre',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservacion" (
    "id" UUID NOT NULL,
    "mesa_id" UUID NOT NULL,
    "cliente_id" UUID,
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "fin" TIMESTAMPTZ(6) NOT NULL,
    "personas" SMALLINT NOT NULL,
    "estado" "EstadoReservacion" NOT NULL DEFAULT 'confirmada',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "mesa_id" UUID,
    "mesero_id" UUID,
    "cliente_id" UUID,
    "tipo_venta" "TipoVenta" NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'abierta',
    "abierta_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "folio" VARCHAR(20) NOT NULL,
    "estacion" "Estacion" NOT NULL,
    "estado" "EstadoComanda" NOT NULL DEFAULT 'pendiente',
    "origen" VARCHAR(40),
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lista_en" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda_detalle" (
    "id" UUID NOT NULL,
    "comanda_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" SMALLINT NOT NULL,
    "nota" VARCHAR(200),

    CONSTRAINT "comanda_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impuesto" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "tasa" DECIMAL(5,2) NOT NULL,
    "incluido_en_precio" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forma_pago" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forma_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cuenta_id" UUID,
    "cliente_id" UUID,
    "caja_sesion_id" UUID,
    "usuario_id" UUID NOT NULL,
    "origen" "OrigenFactura" NOT NULL DEFAULT 'pos',
    "serie" VARCHAR(10) NOT NULL,
    "folio" BIGINT NOT NULL,
    "tipo_venta" "TipoVentaDoc" NOT NULL,
    "subtotal" DECIMAL(12,4) NOT NULL,
    "descuento" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "impuesto_total" DECIMAL(12,4) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'emitida',
    "emitida_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_detalle" (
    "id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "comanda_detalle_id" UUID,
    "descripcion" VARCHAR(160) NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precio_unitario" DECIMAL(12,4) NOT NULL,
    "impuesto_tasa" DECIMAL(5,2) NOT NULL,
    "es_cortesia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "factura_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_detalle_modificador" (
    "id" UUID NOT NULL,
    "factura_detalle_id" UUID NOT NULL,
    "opcion_modificador_id" UUID,
    "nombre" VARCHAR(80) NOT NULL,
    "precio_extra" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "factura_detalle_modificador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "forma_pago_id" UUID NOT NULL,
    "monto" DECIMAL(12,4) NOT NULL,
    "recibido" DECIMAL(12,4),
    "referencia" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota_credito" (
    "id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "emitida_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promocion" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" "TipoPromo" NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "promocion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promocion_objetivo" (
    "id" UUID NOT NULL,
    "promocion_id" UUID NOT NULL,
    "producto_id" UUID,
    "categoria_id" UUID,

    CONSTRAINT "promocion_objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_componente" (
    "id" UUID NOT NULL,
    "promocion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" SMALLINT NOT NULL,

    CONSTRAINT "combo_componente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promocion_aplicacion" (
    "id" UUID NOT NULL,
    "promocion_id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "descuento_aplicado" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "promocion_aplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_sesion" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "caja_id" UUID,
    "usuario_id" UUID NOT NULL,
    "fondo_apertura" DECIMAL(12,4) NOT NULL,
    "efectivo_esperado" DECIMAL(12,4),
    "efectivo_contado" DECIMAL(12,4),
    "estado" "EstadoCajaSesion" NOT NULL DEFAULT 'abierta',
    "abierta_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "caja_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_movimiento" (
    "id" UUID NOT NULL,
    "caja_sesion_id" UUID NOT NULL,
    "tipo" "TipoCajaMov" NOT NULL,
    "concepto" VARCHAR(120) NOT NULL,
    "monto" DECIMAL(12,4) NOT NULL,
    "registrado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caja_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "nit" VARCHAR(20),
    "telefono" VARCHAR(30),
    "email" VARCHAR(160),
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_lealtad" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "quetzales_por_punto" DECIMAL(12,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "config_lealtad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recompensa" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" "TipoRecompensa" NOT NULL,
    "costo_puntos" INTEGER NOT NULL,
    "producto_id" UUID,
    "valor" DECIMAL(12,4),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "recompensa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_lealtad" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "factura_id" UUID,
    "recompensa_id" UUID,
    "tipo" "TipoMovLealtad" NOT NULL,
    "puntos" INTEGER NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_lealtad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_gasto" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "categoria_gasto_id" UUID NOT NULL,
    "proveedor_id" UUID,
    "usuario_id" UUID NOT NULL,
    "concepto" VARCHAR(160) NOT NULL,
    "monto" DECIMAL(12,4) NOT NULL,
    "metodo" "MetodoGasto" NOT NULL,
    "estado" "EstadoGasto" NOT NULL DEFAULT 'pendiente',
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_secuencia" (
    "sucursal_id" UUID NOT NULL,
    "ambito" VARCHAR(30) NOT NULL,
    "ultimo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "folio_secuencia_pkey" PRIMARY KEY ("sucursal_id","ambito")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empleado_id_key" ON "usuario"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE INDEX "bitacora_entidad_entidad_id_idx" ON "bitacora"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "marcaje_empleado_id_entrada_idx" ON "marcaje"("empleado_id", "entrada");

-- CreateIndex
CREATE UNIQUE INDEX "receta_producto_id_key" ON "receta"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "receta_detalle_receta_id_insumo_id_key" ON "receta_detalle"("receta_id", "insumo_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_medida_abreviatura_key" ON "unidad_medida"("abreviatura");

-- CreateIndex
CREATE UNIQUE INDEX "existencia_insumo_id_key" ON "existencia"("insumo_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_insumo_id_created_at_idx" ON "movimiento_inventario"("insumo_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conteo_detalle_conteo_fisico_id_insumo_id_key" ON "conteo_detalle"("conteo_fisico_id", "insumo_id");

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_sucursal_id_folio_key" ON "orden_compra"("sucursal_id", "folio");

-- CreateIndex
CREATE INDEX "comanda_estado_estacion_idx" ON "comanda"("estado", "estacion");

-- CreateIndex
CREATE UNIQUE INDEX "comanda_cuenta_id_folio_key" ON "comanda"("cuenta_id", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "factura_cuenta_id_key" ON "factura"("cuenta_id");

-- CreateIndex
CREATE INDEX "factura_sucursal_id_emitida_en_idx" ON "factura"("sucursal_id", "emitida_en");

-- CreateIndex
CREATE UNIQUE INDEX "factura_sucursal_id_serie_folio_key" ON "factura"("sucursal_id", "serie", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "nota_credito_factura_id_key" ON "nota_credito"("factura_id");

-- CreateIndex
CREATE UNIQUE INDEX "config_lealtad_sucursal_id_key" ON "config_lealtad"("sucursal_id");

-- CreateIndex
CREATE INDEX "movimiento_lealtad_cliente_id_created_at_idx" ON "movimiento_lealtad"("cliente_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_gasto_nombre_key" ON "categoria_gasto"("nombre");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol" ADD CONSTRAINT "rol_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "puesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcaje" ADD CONSTRAINT "marcaje_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcaje" ADD CONSTRAINT "marcaje_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_modificador" ADD CONSTRAINT "grupo_modificador_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion_modificador" ADD CONSTRAINT "opcion_modificador_grupo_modificador_id_fkey" FOREIGN KEY ("grupo_modificador_id") REFERENCES "grupo_modificador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_grupo_modificador" ADD CONSTRAINT "producto_grupo_modificador_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_grupo_modificador" ADD CONSTRAINT "producto_grupo_modificador_grupo_modificador_id_fkey" FOREIGN KEY ("grupo_modificador_id") REFERENCES "grupo_modificador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta" ADD CONSTRAINT "receta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_detalle" ADD CONSTRAINT "receta_detalle_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_detalle" ADD CONSTRAINT "receta_detalle_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_unidad_medida_id_fkey" FOREIGN KEY ("unidad_medida_id") REFERENCES "unidad_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_conteo_fisico_id_fkey" FOREIGN KEY ("conteo_fisico_id") REFERENCES "conteo_fisico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_fisico" ADD CONSTRAINT "conteo_fisico_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_fisico" ADD CONSTRAINT "conteo_fisico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_detalle" ADD CONSTRAINT "conteo_detalle_conteo_fisico_id_fkey" FOREIGN KEY ("conteo_fisico_id") REFERENCES "conteo_fisico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_detalle" ADD CONSTRAINT "conteo_detalle_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_detalle" ADD CONSTRAINT "orden_compra_detalle_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_detalle" ADD CONSTRAINT "orden_compra_detalle_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zona" ADD CONSTRAINT "zona_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa" ADD CONSTRAINT "mesa_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa" ADD CONSTRAINT "mesa_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservacion" ADD CONSTRAINT "reservacion_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservacion" ADD CONSTRAINT "reservacion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_mesero_id_fkey" FOREIGN KEY ("mesero_id") REFERENCES "empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_detalle" ADD CONSTRAINT "comanda_detalle_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_detalle" ADD CONSTRAINT "comanda_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "factura_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "factura_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "factura_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "factura_caja_sesion_id_fkey" FOREIGN KEY ("caja_sesion_id") REFERENCES "caja_sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "factura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle" ADD CONSTRAINT "factura_detalle_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle" ADD CONSTRAINT "factura_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle" ADD CONSTRAINT "factura_detalle_comanda_detalle_id_fkey" FOREIGN KEY ("comanda_detalle_id") REFERENCES "comanda_detalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle_modificador" ADD CONSTRAINT "factura_detalle_modificador_factura_detalle_id_fkey" FOREIGN KEY ("factura_detalle_id") REFERENCES "factura_detalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_detalle_modificador" ADD CONSTRAINT "factura_detalle_modificador_opcion_modificador_id_fkey" FOREIGN KEY ("opcion_modificador_id") REFERENCES "opcion_modificador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "forma_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_credito" ADD CONSTRAINT "nota_credito_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_credito" ADD CONSTRAINT "nota_credito_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion" ADD CONSTRAINT "promocion_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion_objetivo" ADD CONSTRAINT "promocion_objetivo_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion_objetivo" ADD CONSTRAINT "promocion_objetivo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion_objetivo" ADD CONSTRAINT "promocion_objetivo_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_componente" ADD CONSTRAINT "combo_componente_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_componente" ADD CONSTRAINT "combo_componente_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion_aplicacion" ADD CONSTRAINT "promocion_aplicacion_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promocion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promocion_aplicacion" ADD CONSTRAINT "promocion_aplicacion_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja" ADD CONSTRAINT "caja_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesion" ADD CONSTRAINT "caja_sesion_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesion" ADD CONSTRAINT "caja_sesion_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesion" ADD CONSTRAINT "caja_sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_movimiento" ADD CONSTRAINT "caja_movimiento_caja_sesion_id_fkey" FOREIGN KEY ("caja_sesion_id") REFERENCES "caja_sesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_lealtad" ADD CONSTRAINT "config_lealtad_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recompensa" ADD CONSTRAINT "recompensa_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recompensa" ADD CONSTRAINT "recompensa_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_lealtad" ADD CONSTRAINT "movimiento_lealtad_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_lealtad" ADD CONSTRAINT "movimiento_lealtad_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_lealtad" ADD CONSTRAINT "movimiento_lealtad_recompensa_id_fkey" FOREIGN KEY ("recompensa_id") REFERENCES "recompensa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_categoria_gasto_id_fkey" FOREIGN KEY ("categoria_gasto_id") REFERENCES "categoria_gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_secuencia" ADD CONSTRAINT "folio_secuencia_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
