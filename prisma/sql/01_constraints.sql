-- ============================================================================
-- GOPIC · 01_constraints.sql  (IDEMPOTENTE)
-- Restricciones a nivel de base que Prisma no expresa (docs/modelo-entidad-relacion.md §2, §4, §9).
-- Se aplica DESPUÉS de la migración base que crea las tablas.
-- Re-ejecutable: ADD COLUMN IF NOT EXISTS · DROP CONSTRAINT IF EXISTS + ADD · CREATE INDEX IF NOT EXISTS.
-- Nota: los CHECK "estado/tipo IN (...)" ya los garantizan los ENUM de Prisma.
-- Nota: updated_at lo mantiene el trigger set_updated_at (ver 02_functions.sql).
-- ============================================================================
BEGIN;

-- ---- Extensiones ----
CREATE EXTENSION IF NOT EXISTS citext;      -- emails case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE de reservaciones

-- ---- CITEXT en emails (no-op si ya son citext) ----
ALTER TABLE usuario   ALTER COLUMN email TYPE citext;
ALTER TABLE empleado  ALTER COLUMN email TYPE citext;
ALTER TABLE proveedor ALTER COLUMN email TYPE citext;
ALTER TABLE cliente   ALTER COLUMN email TYPE citext;

-- ---- Columnas GENERATED (derivadas, congeladas) ----
ALTER TABLE conteo_detalle       ADD COLUMN IF NOT EXISTS diferencia NUMERIC(12,4) GENERATED ALWAYS AS (cantidad_fisica - cantidad_teorica) STORED;
ALTER TABLE orden_compra_detalle ADD COLUMN IF NOT EXISTS subtotal   NUMERIC(12,4) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED;
ALTER TABLE factura_detalle      ADD COLUMN IF NOT EXISTS subtotal   NUMERIC(12,4) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED;
ALTER TABLE pago                 ADD COLUMN IF NOT EXISTS cambio     NUMERIC(12,4) GENERATED ALWAYS AS (COALESCE(recibido,0) - monto) STORED;
ALTER TABLE caja_sesion          ADD COLUMN IF NOT EXISTS diferencia NUMERIC(12,4) GENERATED ALWAYS AS (efectivo_contado - efectivo_esperado) STORED;
ALTER TABLE reservacion          ADD COLUMN IF NOT EXISTS periodo    tstzrange     GENERATED ALWAYS AS (tstzrange(inicio, fin)) STORED;

-- ---- CHECKs: formato ----
ALTER TABLE sucursal DROP CONSTRAINT IF EXISTS ck_sucursal_moneda, ADD CONSTRAINT ck_sucursal_moneda CHECK (moneda ~ '^[A-Z]{3}$');
ALTER TABLE permiso  DROP CONSTRAINT IF EXISTS ck_permiso_codigo,  ADD CONSTRAINT ck_permiso_codigo  CHECK (codigo ~ '^[a-z_]+\.[a-z_]+$');

-- ---- CHECKs: no-negativos / positivos ----
ALTER TABLE usuario              DROP CONSTRAINT IF EXISTS ck_usuario_intentos,   ADD CONSTRAINT ck_usuario_intentos   CHECK (intentos_fallidos >= 0);
ALTER TABLE puesto               DROP CONSTRAINT IF EXISTS ck_puesto_salario,     ADD CONSTRAINT ck_puesto_salario     CHECK (salario_base >= 0);
ALTER TABLE producto             DROP CONSTRAINT IF EXISTS ck_producto_precio,    ADD CONSTRAINT ck_producto_precio    CHECK (precio >= 0);
ALTER TABLE opcion_modificador   DROP CONSTRAINT IF EXISTS ck_opcion_precio,      ADD CONSTRAINT ck_opcion_precio      CHECK (precio_extra >= 0);
ALTER TABLE receta               DROP CONSTRAINT IF EXISTS ck_receta_rendimiento, ADD CONSTRAINT ck_receta_rendimiento CHECK (rendimiento > 0);
ALTER TABLE receta_detalle       DROP CONSTRAINT IF EXISTS ck_recdet_cantidad,    ADD CONSTRAINT ck_recdet_cantidad    CHECK (cantidad > 0);
ALTER TABLE receta_detalle       DROP CONSTRAINT IF EXISTS ck_recdet_merma,       ADD CONSTRAINT ck_recdet_merma       CHECK (merma_pct >= 0 AND merma_pct < 100);
ALTER TABLE insumo               DROP CONSTRAINT IF EXISTS ck_insumo_min,         ADD CONSTRAINT ck_insumo_min         CHECK (stock_minimo >= 0);
ALTER TABLE insumo               DROP CONSTRAINT IF EXISTS ck_insumo_reorden,     ADD CONSTRAINT ck_insumo_reorden     CHECK (punto_reorden >= 0);
ALTER TABLE existencia           DROP CONSTRAINT IF EXISTS ck_existencia_cant,    ADD CONSTRAINT ck_existencia_cant    CHECK (cantidad >= 0);
ALTER TABLE orden_compra         DROP CONSTRAINT IF EXISTS ck_oc_total,           ADD CONSTRAINT ck_oc_total           CHECK (total >= 0);
ALTER TABLE orden_compra_detalle DROP CONSTRAINT IF EXISTS ck_ocdet_cantidad,     ADD CONSTRAINT ck_ocdet_cantidad     CHECK (cantidad > 0);
ALTER TABLE orden_compra_detalle DROP CONSTRAINT IF EXISTS ck_ocdet_costo,        ADD CONSTRAINT ck_ocdet_costo        CHECK (costo_unitario >= 0);
ALTER TABLE mesa                 DROP CONSTRAINT IF EXISTS ck_mesa_capacidad,     ADD CONSTRAINT ck_mesa_capacidad     CHECK (capacidad > 0);
ALTER TABLE comanda_detalle      DROP CONSTRAINT IF EXISTS ck_comdet_cantidad,    ADD CONSTRAINT ck_comdet_cantidad    CHECK (cantidad > 0);
ALTER TABLE factura_detalle      DROP CONSTRAINT IF EXISTS ck_facdet_cantidad,    ADD CONSTRAINT ck_facdet_cantidad    CHECK (cantidad > 0);
ALTER TABLE factura_detalle      DROP CONSTRAINT IF EXISTS ck_facdet_precio,      ADD CONSTRAINT ck_facdet_precio      CHECK (precio_unitario >= 0);
ALTER TABLE factura_detalle_modificador DROP CONSTRAINT IF EXISTS ck_facmod_precio, ADD CONSTRAINT ck_facmod_precio    CHECK (precio_extra >= 0);
ALTER TABLE pago                 DROP CONSTRAINT IF EXISTS ck_pago_monto,         ADD CONSTRAINT ck_pago_monto         CHECK (monto > 0);
ALTER TABLE nota_credito         DROP CONSTRAINT IF EXISTS ck_nc_monto,           ADD CONSTRAINT ck_nc_monto           CHECK (monto > 0);
ALTER TABLE promocion            DROP CONSTRAINT IF EXISTS ck_promo_valor,        ADD CONSTRAINT ck_promo_valor        CHECK (valor >= 0);
ALTER TABLE combo_componente     DROP CONSTRAINT IF EXISTS ck_combo_cantidad,     ADD CONSTRAINT ck_combo_cantidad     CHECK (cantidad > 0);
ALTER TABLE promocion_aplicacion DROP CONSTRAINT IF EXISTS ck_promoap_desc,       ADD CONSTRAINT ck_promoap_desc       CHECK (descuento_aplicado >= 0);
ALTER TABLE caja_sesion          DROP CONSTRAINT IF EXISTS ck_cajases_fondo,      ADD CONSTRAINT ck_cajases_fondo      CHECK (fondo_apertura >= 0);
ALTER TABLE caja_movimiento      DROP CONSTRAINT IF EXISTS ck_cajamov_monto,      ADD CONSTRAINT ck_cajamov_monto      CHECK (monto > 0);
ALTER TABLE cliente              DROP CONSTRAINT IF EXISTS ck_cliente_puntos,     ADD CONSTRAINT ck_cliente_puntos     CHECK (puntos >= 0);
ALTER TABLE cliente              DROP CONSTRAINT IF EXISTS ck_cliente_visitas,    ADD CONSTRAINT ck_cliente_visitas    CHECK (visitas >= 0);
ALTER TABLE config_lealtad       DROP CONSTRAINT IF EXISTS ck_conflealtad_qpp,    ADD CONSTRAINT ck_conflealtad_qpp    CHECK (quetzales_por_punto > 0);
ALTER TABLE recompensa           DROP CONSTRAINT IF EXISTS ck_recompensa_costo,   ADD CONSTRAINT ck_recompensa_costo   CHECK (costo_puntos > 0);
ALTER TABLE gasto                DROP CONSTRAINT IF EXISTS ck_gasto_monto,        ADD CONSTRAINT ck_gasto_monto        CHECK (monto > 0);
ALTER TABLE factura              DROP CONSTRAINT IF EXISTS ck_factura_folio,      ADD CONSTRAINT ck_factura_folio      CHECK (folio > 0);
ALTER TABLE factura              DROP CONSTRAINT IF EXISTS ck_factura_montos,     ADD CONSTRAINT ck_factura_montos     CHECK (subtotal >= 0 AND descuento >= 0 AND impuesto_total >= 0 AND total >= 0);
ALTER TABLE conteo_detalle       DROP CONSTRAINT IF EXISTS ck_condet_fisica,      ADD CONSTRAINT ck_condet_fisica      CHECK (cantidad_fisica >= 0);
ALTER TABLE reservacion          DROP CONSTRAINT IF EXISTS ck_reserv_personas,    ADD CONSTRAINT ck_reserv_personas    CHECK (personas > 0);

-- ---- CHECKs: condicionales / integridad de dominio ----
ALTER TABLE marcaje DROP CONSTRAINT IF EXISTS ck_marcaje_salida,  ADD CONSTRAINT ck_marcaje_salida  CHECK (salida IS NULL OR entrada IS NULL OR salida >= entrada);
ALTER TABLE marcaje DROP CONSTRAINT IF EXISTS ck_marcaje_minutos, ADD CONSTRAINT ck_marcaje_minutos CHECK (minutos_trabajados IS NULL OR minutos_trabajados >= 0);
ALTER TABLE reservacion DROP CONSTRAINT IF EXISTS ck_reserv_rango, ADD CONSTRAINT ck_reserv_rango CHECK (fin > inicio);
ALTER TABLE cuenta DROP CONSTRAINT IF EXISTS ck_cuenta_mesa, ADD CONSTRAINT ck_cuenta_mesa CHECK (tipo_venta <> 'mesa' OR mesa_id IS NOT NULL);
ALTER TABLE factura DROP CONSTRAINT IF EXISTS ck_factura_caja_online, ADD CONSTRAINT ck_factura_caja_online CHECK (caja_sesion_id IS NOT NULL OR origen = 'online');
ALTER TABLE factura_detalle DROP CONSTRAINT IF EXISTS ck_facdet_cortesia, ADD CONSTRAINT ck_facdet_cortesia CHECK (NOT es_cortesia OR precio_unitario = 0);
ALTER TABLE promocion DROP CONSTRAINT IF EXISTS ck_promo_vigencia, ADD CONSTRAINT ck_promo_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta > vigencia_desde);

ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS ck_movinv_cantidad, ADD CONSTRAINT ck_movinv_cantidad CHECK (cantidad <> 0);
ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS ck_movinv_saldo,    ADD CONSTRAINT ck_movinv_saldo    CHECK (saldo >= 0);
ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS ck_movinv_costo,    ADD CONSTRAINT ck_movinv_costo    CHECK (costo_unitario >= 0);
ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS ck_movinv_origen,   ADD CONSTRAINT ck_movinv_origen   CHECK (num_nonnulls(orden_compra_id, factura_id, conteo_fisico_id) <= 1);
ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS ck_movinv_motivo,   ADD CONSTRAINT ck_movinv_motivo   CHECK (tipo NOT IN ('Merma','Ajuste') OR motivo IS NOT NULL);

ALTER TABLE recompensa DROP CONSTRAINT IF EXISTS ck_recompensa_tipo, ADD CONSTRAINT ck_recompensa_tipo CHECK (
  (tipo = 'producto' AND producto_id IS NOT NULL AND valor IS NULL) OR
  (tipo IN ('descuento_monto','descuento_pct') AND valor IS NOT NULL AND producto_id IS NULL)
);

ALTER TABLE movimiento_lealtad DROP CONSTRAINT IF EXISTS ck_movltd_puntos, ADD CONSTRAINT ck_movltd_puntos CHECK (
  (tipo = 'acumula' AND puntos > 0) OR (tipo = 'canjea' AND puntos < 0)
);

-- ---- Índices únicos PARCIALES (respetan borrado lógico / estado) ----
CREATE UNIQUE INDEX IF NOT EXISTS uq_rol_nombre
  ON rol (COALESCE(sucursal_id, '00000000-0000-0000-0000-000000000000'::uuid), nombre)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categoria_nombre ON categoria (sucursal_id, nombre) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_nombre  ON producto  (sucursal_id, nombre) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_nit      ON cliente   (sucursal_id, nit) WHERE nit IS NOT NULL AND nit <> 'CF';
CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_abierta     ON caja_sesion (sucursal_id, usuario_id) WHERE estado = 'abierta';
CREATE INDEX        IF NOT EXISTS ix_sesion_usuario_activa ON sesion (usuario_id) WHERE revocada = false;

-- ---- Anti-solape de reservaciones (una mesa no se reserva dos veces a la vez) ----
ALTER TABLE reservacion DROP CONSTRAINT IF EXISTS reservacion_no_solape,
  ADD CONSTRAINT reservacion_no_solape EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&) WHERE (estado = 'confirmada');

COMMIT;
