import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Hash de contraseña con scrypt (sin dependencias). Formato: scrypt$salt$hash. */
function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  // Idempotencia simple: si ya hay una sucursal, no re-sembramos.
  if ((await prisma.sucursal.count()) > 0) {
    console.log('⏭  Ya existen datos; se omite el seed.');
    return;
  }

  console.log('🌱 Sembrando datos demo…');

  // ── Sucursal ──
  const sucursal = await prisma.sucursal.create({
    data: {
      nombre: 'GOPIC · Sucursal Central',
      nit: '1234567-8',
      direccion: 'Zona 1, Ciudad de Guatemala',
      telefono: '+502 2222 3333',
      moneda: 'GTQ',
    },
  });
  const sucursalId = sucursal.id;

  // ── Globales: impuestos, formas de pago, unidades, categorías de gasto ──
  await prisma.impuesto.create({ data: { nombre: 'IVA', tasa: 12, incluidoEnPrecio: true } });
  const [formaEfectivo] = await Promise.all([
    prisma.formaPago.create({ data: { nombre: 'Efectivo' } }),
    prisma.formaPago.create({ data: { nombre: 'Tarjeta', requiereReferencia: true } }),
  ]);

  const unidades = await Promise.all(
    [
      { nombre: 'Kilogramo', abreviatura: 'kg', tipo: 'Peso' as const },
      { nombre: 'Litro', abreviatura: 'L', tipo: 'Volumen' as const },
      { nombre: 'Pieza', abreviatura: 'pz', tipo: 'Unidad' as const },
      { nombre: 'Bolsa', abreviatura: 'bolsa', tipo: 'Unidad' as const },
    ].map((u) => prisma.unidadMedida.create({ data: u })),
  );
  const uKg = unidades[0].id;
  const uPz = unidades[2].id;

  await prisma.categoriaGasto.createMany({
    data: ['Renta', 'Servicios', 'Nómina', 'Insumos', 'Mantenimiento', 'Otros'].map((nombre) => ({ nombre })),
  });

  // ── Puestos y empleados ──
  const puestoAdmin = await prisma.puesto.create({ data: { nombre: 'Administrador', salarioBase: 6000 } });
  const puestoCajero = await prisma.puesto.create({ data: { nombre: 'Cajero', salarioBase: 3500 } });

  const empAdmin = await prisma.empleado.create({
    data: { sucursalId, puestoId: puestoAdmin.id, nombre: 'Ana Rodríguez', email: 'ana@gopic.gt', fechaIngreso: new Date('2025-01-15') },
  });
  const empColab = await prisma.empleado.create({
    data: { sucursalId, puestoId: puestoCajero.id, nombre: 'Luis Gómez', email: 'luis@gopic.gt', fechaIngreso: new Date('2025-03-01') },
  });

  // ── RBAC: roles, permisos, usuarios ──
  const rolAdmin = await prisma.rol.create({ data: { sucursalId, nombre: 'Administrador', descripcion: 'Acceso total', esSistema: true } });
  const rolColab = await prisma.rol.create({ data: { sucursalId, nombre: 'Colaborador', descripcion: 'Operación diaria', esSistema: true } });

  const permisos = await Promise.all(
    [
      { codigo: 'pos.operar', descripcion: 'Operar el punto de venta', modulo: 'pos' },
      { codigo: 'reportes.ver', descripcion: 'Ver reportes', modulo: 'reportes' },
      { codigo: 'config.editar', descripcion: 'Editar configuración', modulo: 'config' },
      { codigo: 'inventario.gestionar', descripcion: 'Gestionar inventario', modulo: 'inventario' },
    ].map((p) => prisma.permiso.create({ data: p })),
  );
  // Admin: todos los permisos. Colaborador: solo operar POS.
  await prisma.rolPermiso.createMany({ data: permisos.map((p) => ({ rolId: rolAdmin.id, permisoId: p.id })) });
  await prisma.rolPermiso.create({ data: { rolId: rolColab.id, permisoId: permisos[0].id } });

  const usuAdmin = await prisma.usuario.create({
    data: { sucursalId, empleadoId: empAdmin.id, email: 'ana@gopic.gt', passwordHash: hashPassword('admin123') },
  });
  const usuColab = await prisma.usuario.create({
    data: { sucursalId, empleadoId: empColab.id, email: 'luis@gopic.gt', passwordHash: hashPassword('colab123') },
  });
  await prisma.usuarioRol.createMany({
    data: [
      { usuarioId: usuAdmin.id, rolId: rolAdmin.id },
      { usuarioId: usuColab.id, rolId: rolColab.id },
    ],
  });

  // ── Catálogo: categorías y productos ──
  const catBurgers = await prisma.categoria.create({ data: { sucursalId, nombre: 'Hamburguesas', icono: 'Beef', orden: 1 } });
  const catFritos = await prisma.categoria.create({ data: { sucursalId, nombre: 'Papas y fritos', icono: 'Utensils', orden: 2 } });
  const catAntojitos = await prisma.categoria.create({ data: { sucursalId, nombre: 'Antojitos', icono: 'Drumstick', orden: 3 } });
  const catFrios = await prisma.categoria.create({ data: { sucursalId, nombre: 'Fríos', icono: 'IceCreamCone', orden: 4 } });

  const pHamburguesa = await prisma.producto.create({
    data: { sucursalId, categoriaId: catBurgers.id, nombre: 'Hamburguesa clásica', precio: 38, estacion: 'Cocina', destacado: true },
  });
  await prisma.producto.createMany({
    data: [
      { sucursalId, categoriaId: catBurgers.id, nombre: 'Cheeseburger', precio: 42, estacion: 'Cocina' },
      { sucursalId, categoriaId: catBurgers.id, nombre: 'Doble carne', precio: 55, estacion: 'Cocina', destacado: true },
      { sucursalId, categoriaId: catFritos.id, nombre: 'Papas fritas', precio: 22, estacion: 'Cocina', destacado: true },
      { sucursalId, categoriaId: catFritos.id, nombre: 'Aros de cebolla', precio: 28, estacion: 'Cocina' },
      { sucursalId, categoriaId: catAntojitos.id, nombre: 'Salchipapas', precio: 35, estacion: 'Cocina', destacado: true },
      { sucursalId, categoriaId: catAntojitos.id, nombre: 'Alitas BBQ', precio: 48, estacion: 'Cocina' },
      { sucursalId, categoriaId: catFrios.id, nombre: 'Malteada', precio: 30, estacion: 'Barra', destacado: true },
      { sucursalId, categoriaId: catFrios.id, nombre: 'Refresco', precio: 15, estacion: 'Barra' },
    ],
  });

  // ── Modificadores (término + extras) para la hamburguesa ──
  const grpTermino = await prisma.grupoModificador.create({
    data: {
      sucursalId,
      nombre: 'Término',
      requerido: true,
      multiple: false,
      opciones: { create: [{ nombre: 'Término medio' }, { nombre: 'Tres cuartos' }, { nombre: 'Bien cocido' }] },
    },
  });
  const grpExtras = await prisma.grupoModificador.create({
    data: {
      sucursalId,
      nombre: 'Extras',
      requerido: false,
      multiple: true,
      opciones: { create: [{ nombre: 'Queso extra', precioExtra: 6 }, { nombre: 'Tocino', precioExtra: 8 }, { nombre: 'Aguacate', precioExtra: 7 }] },
    },
  });
  await prisma.productoGrupoModificador.createMany({
    data: [
      { productoId: pHamburguesa.id, grupoModificadorId: grpTermino.id },
      { productoId: pHamburguesa.id, grupoModificadorId: grpExtras.id },
    ],
  });

  // ── Inventario: insumos + existencias + una receta ──
  const insCarne = await prisma.insumo.create({
    data: { sucursalId, unidadMedidaId: uKg, nombre: 'Carne de res (molida)', categoria: 'Cárnicos', tipo: 'materia_prima', costoPromedio: 62, stockMinimo: 8, existencia: { create: { sucursalId, cantidad: 3 } } },
  });
  const insPan = await prisma.insumo.create({
    data: { sucursalId, unidadMedidaId: uPz, nombre: 'Pan de hamburguesa', categoria: 'Panadería', tipo: 'materia_prima', costoPromedio: 2.5, stockMinimo: 100, existencia: { create: { sucursalId, cantidad: 40 } } },
  });
  const insQueso = await prisma.insumo.create({
    data: { sucursalId, unidadMedidaId: uKg, nombre: 'Queso amarillo', categoria: 'Lácteos', tipo: 'materia_prima', costoPromedio: 55, stockMinimo: 3, existencia: { create: { sucursalId, cantidad: 4.5 } } },
  });

  await prisma.receta.create({
    data: {
      productoId: pHamburguesa.id,
      rendimiento: 1,
      costoCalculado: 20,
      detalles: {
        create: [
          { insumoId: insCarne.id, cantidad: 0.15 },
          { insumoId: insPan.id, cantidad: 1 },
          { insumoId: insQueso.id, cantidad: 0.03 },
        ],
      },
    },
  });

  // ── Salón: zona + mesas ──
  const zonaSalon = await prisma.zona.create({ data: { sucursalId, nombre: 'Salón' } });
  await prisma.mesa.createMany({
    data: [
      { sucursalId, zonaId: zonaSalon.id, nombre: 'Mesa 1', capacidad: 2 },
      { sucursalId, zonaId: zonaSalon.id, nombre: 'Mesa 2', capacidad: 4 },
      { sucursalId, zonaId: zonaSalon.id, nombre: 'Mesa 3', capacidad: 4 },
      { sucursalId, zonaId: zonaSalon.id, nombre: 'Mesa 4', capacidad: 6 },
    ],
  });

  // ── Caja física ──
  await prisma.caja.create({ data: { sucursalId, nombre: 'Caja 1' } });

  // ── Clientes + fidelización ──
  await prisma.cliente.create({ data: { sucursalId, nombre: 'Consumidor Final', nit: 'CF' } });
  await prisma.cliente.create({ data: { sucursalId, nombre: 'María Fernández', nit: '2456781-0', telefono: '+502 5544 1122', email: 'maria.f@mail.gt', puntos: 180, visitas: 18 } });

  await prisma.configLealtad.create({ data: { sucursalId, quetzalesPorPunto: 10 } });
  await prisma.recompensa.createMany({
    data: [
      { sucursalId, nombre: 'Q10 de descuento', tipo: 'descuento_monto', costoPuntos: 100, valor: 10 },
      { sucursalId, nombre: '10% de descuento', tipo: 'descuento_pct', costoPuntos: 150, valor: 10 },
      { sucursalId, nombre: 'Refresco gratis', tipo: 'producto', costoPuntos: 80, productoId: pHamburguesa.id },
    ],
  });

  // ── Secuencias de folio ──
  await prisma.folioSecuencia.createMany({
    data: [
      { sucursalId, ambito: 'factura:A', ultimo: 0 },
      { sucursalId, ambito: 'orden_compra', ultimo: 0 },
    ],
  });

  console.log('✅ Seed completo:');
  console.log(`   Sucursal: ${sucursal.nombre}`);
  console.log(`   Login admin:       ana@gopic.gt / admin123`);
  console.log(`   Login colaborador: luis@gopic.gt / colab123`);
  console.log(`   Forma de pago default: ${formaEfectivo.nombre}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
