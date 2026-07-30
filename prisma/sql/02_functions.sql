-- ============================================================================
-- GOPIC · 02_functions.sql
-- Capa de lógica en la base (docs/modelo-entidad-relacion.md §7, §10).
-- Cada proceso es una función transaccional que el backend invoca con SELECT.
--
-- ⚠ VALIDAR CONTRA UNA BASE REAL: son la traducción de los contratos §10;
--   deben probarse con datos antes de usarse en producción.
-- Nota: los IDs se generan con gen_random_uuid() (core en PostgreSQL 13+),
--       porque el @default(uuid()) de Prisma es del lado de la app.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- Trigger genérico: mantiene updated_at en INSERT/UPDATE.
-- (Permite que las funciones inserten sin fijar updated_at manualmente.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'sucursal','usuario','rol','puesto','empleado','turno','marcaje','categoria',
    'producto','grupo_modificador','opcion_modificador','receta','receta_detalle',
    'insumo','existencia','conteo_fisico','proveedor','orden_compra','zona','mesa',
    'reservacion','cuenta','comanda','promocion','caja','caja_sesion','cliente',
    'config_lealtad','recompensa','gasto'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- siguiente_folio: folios consecutivos race-safe por sucursal y ámbito.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siguiente_folio(p_sucursal uuid, p_ambito varchar)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO folio_secuencia (sucursal_id, ambito, ultimo)
    VALUES (p_sucursal, p_ambito, 1)
  ON CONFLICT (sucursal_id, ambito)
    DO UPDATE SET ultimo = folio_secuencia.ultimo + 1
  RETURNING ultimo INTO v;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------------
-- registrar_movimiento_inventario: kardex + saldo (lock) + costo promedio.
-- p_cantidad SIGNADA: + entra, − sale.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_movimiento_inventario(
  p_insumo uuid, p_sucursal uuid, p_tipo text, p_cantidad numeric, p_costo numeric,
  p_motivo text, p_usuario uuid, p_oc uuid, p_factura uuid, p_conteo uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_actual numeric := 0;
  v_nuevo  numeric;
  v_prom   numeric;
  v_id     uuid := gen_random_uuid();
BEGIN
  SELECT cantidad INTO v_actual FROM existencia WHERE insumo_id = p_insumo FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO existencia (id, insumo_id, sucursal_id, cantidad)
      VALUES (gen_random_uuid(), p_insumo, p_sucursal, 0);
    v_actual := 0;
  END IF;

  v_nuevo := v_actual + p_cantidad;
  IF v_nuevo < 0 THEN
    RAISE EXCEPTION 'Existencia insuficiente para insumo % (actual %, movimiento %)',
      p_insumo, v_actual, p_cantidad;
  END IF;

  -- Costo promedio ponderado: solo en entradas.
  IF p_tipo = 'Entrada' AND p_cantidad > 0 THEN
    SELECT costo_promedio INTO v_prom FROM insumo WHERE id = p_insumo FOR UPDATE;
    v_prom := CASE WHEN v_nuevo > 0
      THEN ((v_actual * v_prom) + (p_cantidad * p_costo)) / v_nuevo
      ELSE v_prom END;
    UPDATE insumo SET costo_promedio = v_prom WHERE id = p_insumo;
  END IF;

  INSERT INTO movimiento_inventario
    (id, insumo_id, sucursal_id, tipo, cantidad, saldo, costo_unitario, motivo,
     orden_compra_id, factura_id, conteo_fisico_id, usuario_id)
  VALUES
    (v_id, p_insumo, p_sucursal, p_tipo::"TipoMovInv", p_cantidad, v_nuevo, p_costo, p_motivo,
     p_oc, p_factura, p_conteo, p_usuario);

  UPDATE existencia SET cantidad = v_nuevo WHERE insumo_id = p_insumo;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- explotar_receta: descuenta los insumos de la receta aplicando merma.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION explotar_receta(
  p_producto uuid, p_cantidad numeric, p_sucursal uuid, p_factura uuid,
  p_motivo text, p_usuario uuid
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_receta uuid;
  r RECORD;
BEGIN
  SELECT id INTO v_receta FROM receta WHERE producto_id = p_producto;
  IF NOT FOUND THEN RETURN; END IF;  -- producto sin receta: nada que descontar

  FOR r IN
    SELECT rd.insumo_id, rd.cantidad, rd.merma_pct, i.costo_promedio
    FROM receta_detalle rd JOIN insumo i ON i.id = rd.insumo_id
    WHERE rd.receta_id = v_receta
  LOOP
    PERFORM registrar_movimiento_inventario(
      r.insumo_id, p_sucursal, 'Salida',
      -(r.cantidad * (1 + r.merma_pct / 100.0) * p_cantidad),
      r.costo_promedio, p_motivo, p_usuario, NULL, p_factura, NULL);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- acumular_puntos: FLOOR(total / quetzales_por_punto) si el programa está activo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION acumular_puntos(p_cliente uuid, p_factura uuid, p_total numeric)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_suc uuid; v_qpp numeric; v_activo boolean; v_ganados int;
BEGIN
  SELECT sucursal_id INTO v_suc FROM cliente WHERE id = p_cliente;
  SELECT quetzales_por_punto, activo INTO v_qpp, v_activo FROM config_lealtad WHERE sucursal_id = v_suc;
  IF NOT FOUND OR NOT v_activo OR v_qpp <= 0 THEN RETURN 0; END IF;

  v_ganados := floor(p_total / v_qpp);
  IF v_ganados > 0 THEN
    INSERT INTO movimiento_lealtad (id, cliente_id, factura_id, tipo, puntos, descripcion)
      VALUES (gen_random_uuid(), p_cliente, p_factura, 'acumula', v_ganados, 'Acumulación por compra');
    UPDATE cliente SET puntos = puntos + v_ganados, visitas = visitas + 1 WHERE id = p_cliente;
  ELSE
    UPDATE cliente SET visitas = visitas + 1 WHERE id = p_cliente;
  END IF;
  RETURN v_ganados;
END;
$$;

-- ---------------------------------------------------------------------------
-- canjear_recompensa: valida saldo con lock y descuenta puntos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION canjear_recompensa(p_cliente uuid, p_recompensa uuid, p_factura uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_costo int; v_puntos int; v_id uuid := gen_random_uuid();
BEGIN
  SELECT puntos INTO v_puntos FROM cliente WHERE id = p_cliente FOR UPDATE;
  SELECT costo_puntos INTO v_costo FROM recompensa WHERE id = p_recompensa;
  IF v_puntos < v_costo THEN
    RAISE EXCEPTION 'Puntos insuficientes (tiene %, requiere %)', v_puntos, v_costo;
  END IF;
  UPDATE cliente SET puntos = puntos - v_costo WHERE id = p_cliente;
  INSERT INTO movimiento_lealtad (id, cliente_id, factura_id, recompensa_id, tipo, puntos, descripcion)
    VALUES (v_id, p_cliente, p_factura, p_recompensa, 'canjea', -v_costo, 'Canje de recompensa');
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- registrar_venta: venta POS completa y atómica.
-- items/pagos/promociones en JSONB (ver contrato en el README/§10.2).
-- IVA INCLUIDO en precios: impuesto = total * tasa / (100 + tasa).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_venta(
  p_sucursal uuid, p_caja_sesion uuid, p_usuario uuid, p_serie varchar, p_tipo_venta text,
  p_items jsonb, p_pagos jsonb, p_cuenta uuid, p_cliente uuid, p_descuento numeric,
  p_promociones jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_factura uuid := gen_random_uuid();
  v_folio bigint;
  v_bruto numeric := 0;
  v_impuesto numeric := 0;
  v_desc numeric := COALESCE(p_descuento, 0);
  v_total numeric;
  v_subtotal numeric;
  v_pagado numeric := 0;
  v_puntos int := 0;
  v_ratio numeric;
  v_detalle uuid;
  item jsonb; modif jsonb; pg jsonb; pr jsonb;
  v_cant numeric; v_precio numeric; v_tasa numeric; v_mods numeric;
BEGIN
  v_folio := siguiente_folio(p_sucursal, 'factura:' || p_serie);

  -- 1) Totales brutos e impuesto (IVA incluido)
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant  := (item->>'cantidad')::numeric;
    v_precio := (item->>'precio_unitario')::numeric;
    v_tasa  := COALESCE((item->>'impuesto_tasa')::numeric, 0);
    v_mods  := 0;
    IF item ? 'modificadores' THEN
      SELECT COALESCE(SUM((m->>'precio_extra')::numeric), 0) INTO v_mods
      FROM jsonb_array_elements(item->'modificadores') m;
    END IF;
    v_bruto := v_bruto + v_cant * v_precio + v_cant * v_mods;
    v_impuesto := v_impuesto + (v_cant * v_precio + v_cant * v_mods) * v_tasa / (100 + v_tasa);
  END LOOP;

  -- Descuentos (manual + promociones), sin pasar del bruto
  SELECT v_desc + COALESCE(SUM((p->>'descuento_aplicado')::numeric), 0)
    INTO v_desc
    FROM jsonb_array_elements(COALESCE(p_promociones, '[]'::jsonb)) p;
  IF v_desc > v_bruto THEN v_desc := v_bruto; END IF;

  v_total := round(v_bruto - v_desc, 2);
  v_ratio := CASE WHEN v_bruto > 0 THEN (v_bruto - v_desc) / v_bruto ELSE 1 END;
  v_impuesto := round(v_impuesto * v_ratio, 4);
  v_subtotal := v_total - v_impuesto;

  -- 2) Factura
  INSERT INTO factura
    (id, sucursal_id, cuenta_id, cliente_id, caja_sesion_id, usuario_id, origen, serie, folio,
     tipo_venta, subtotal, descuento, impuesto_total, total, estado)
  VALUES
    (v_factura, p_sucursal, p_cuenta, p_cliente, p_caja_sesion, p_usuario, 'pos', p_serie, v_folio,
     p_tipo_venta::"TipoVentaDoc", v_subtotal, v_desc, v_impuesto, v_total, 'emitida');

  -- 3) Detalles + modificadores + explosión de receta (al cobrar)
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_detalle := gen_random_uuid();
    INSERT INTO factura_detalle
      (id, factura_id, producto_id, comanda_detalle_id, descripcion, cantidad, precio_unitario,
       impuesto_tasa, es_cortesia)
    VALUES
      (v_detalle, v_factura, (item->>'producto_id')::uuid, NULLIF(item->>'comanda_detalle_id','')::uuid,
       item->>'descripcion', (item->>'cantidad')::numeric, (item->>'precio_unitario')::numeric,
       COALESCE((item->>'impuesto_tasa')::numeric, 0), COALESCE((item->>'es_cortesia')::boolean, false));

    IF item ? 'modificadores' THEN
      FOR modif IN SELECT * FROM jsonb_array_elements(item->'modificadores') LOOP
        INSERT INTO factura_detalle_modificador
          (id, factura_detalle_id, opcion_modificador_id, nombre, precio_extra)
        VALUES
          (gen_random_uuid(), v_detalle, NULLIF(modif->>'opcion_modificador_id','')::uuid,
           modif->>'nombre', (modif->>'precio_extra')::numeric);
      END LOOP;
    END IF;

    PERFORM explotar_receta(
      (item->>'producto_id')::uuid, (item->>'cantidad')::numeric, p_sucursal, v_factura,
      CASE WHEN COALESCE((item->>'es_cortesia')::boolean, false)
        THEN 'Canje de lealtad'
        ELSE 'Venta ' || p_serie || '-' || v_folio END,
      p_usuario);
  END LOOP;

  -- 4) Pagos (Σ ≥ total)
  SELECT COALESCE(SUM((p->>'monto')::numeric), 0) INTO v_pagado
    FROM jsonb_array_elements(p_pagos) p;
  IF v_pagado < v_total THEN
    RAISE EXCEPTION 'Pago insuficiente: recibido %, total %', v_pagado, v_total;
  END IF;
  FOR pg IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
    INSERT INTO pago (id, factura_id, forma_pago_id, monto, recibido, referencia)
      VALUES (gen_random_uuid(), v_factura, (pg->>'forma_pago_id')::uuid, (pg->>'monto')::numeric,
              NULLIF(pg->>'recibido','')::numeric, pg->>'referencia');
  END LOOP;

  -- 5) Promociones aplicadas
  FOR pr IN SELECT * FROM jsonb_array_elements(COALESCE(p_promociones, '[]'::jsonb)) LOOP
    INSERT INTO promocion_aplicacion (id, promocion_id, factura_id, descuento_aplicado)
      VALUES (gen_random_uuid(), (pr->>'promocion_id')::uuid, v_factura, (pr->>'descuento_aplicado')::numeric);
  END LOOP;

  -- 6) Puntos de lealtad
  IF p_cliente IS NOT NULL THEN
    v_puntos := acumular_puntos(p_cliente, v_factura, v_total);
  END IF;

  -- 7) Cerrar la cuenta
  IF p_cuenta IS NOT NULL THEN
    UPDATE cuenta SET estado = 'cobrada' WHERE id = p_cuenta;
  END IF;

  RETURN jsonb_build_object(
    'factura_id', v_factura, 'folio', v_folio, 'serie', p_serie,
    'subtotal', v_subtotal, 'impuesto_total', v_impuesto, 'total', v_total,
    'puntos_ganados', v_puntos);
END;
$$;

-- ---------------------------------------------------------------------------
-- cancelar_factura: nota de crédito + reverso de inventario + reverso de puntos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_factura(p_factura uuid, p_usuario uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_estado "EstadoFactura"; v_total numeric; v_suc uuid; v_cliente uuid;
  v_nc uuid := gen_random_uuid(); r RECORD; v_pts int;
BEGIN
  SELECT estado, total, sucursal_id, cliente_id
    INTO v_estado, v_total, v_suc, v_cliente
    FROM factura WHERE id = p_factura FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura % no existe', p_factura; END IF;
  IF v_estado = 'cancelada' THEN RAISE EXCEPTION 'La factura ya está cancelada'; END IF;

  INSERT INTO nota_credito (id, factura_id, usuario_id, motivo, monto)
    VALUES (v_nc, p_factura, p_usuario, p_motivo, v_total);

  -- Reingresar inventario: reversa de cada Salida de esta factura.
  FOR r IN
    SELECT insumo_id, cantidad, costo_unitario FROM movimiento_inventario
    WHERE factura_id = p_factura AND tipo = 'Salida'
  LOOP
    PERFORM registrar_movimiento_inventario(
      r.insumo_id, v_suc, 'Entrada', abs(r.cantidad), r.costo_unitario,
      'Reverso cancelación factura', p_usuario, NULL, p_factura, NULL);
  END LOOP;

  -- Reversar puntos acumulados por la factura.
  IF v_cliente IS NOT NULL THEN
    SELECT COALESCE(SUM(puntos), 0) INTO v_pts
      FROM movimiento_lealtad WHERE factura_id = p_factura AND tipo = 'acumula';
    IF v_pts > 0 THEN
      UPDATE cliente SET puntos = GREATEST(0, puntos - v_pts) WHERE id = v_cliente;
      INSERT INTO movimiento_lealtad (id, cliente_id, factura_id, tipo, puntos, descripcion)
        VALUES (gen_random_uuid(), v_cliente, p_factura, 'canjea', -v_pts, 'Reverso por cancelación');
    END IF;
  END IF;

  UPDATE factura SET estado = 'cancelada' WHERE id = p_factura;
  RETURN v_nc;
END;
$$;

COMMIT;
