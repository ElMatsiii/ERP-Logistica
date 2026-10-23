import { PrismaClient, EstadoOT } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Iniciando seed de Base de Datos para LesGo ERP (Esquema: logistica)...');

  // Limpiar tablas previas en orden de dependencias
  await prisma.comprasOcDetalle.deleteMany({});
  await prisma.comprasOc.deleteMany({});
  await prisma.rrhhUsuario.deleteMany({});
  await prisma.rrhhRol.deleteMany({});
  await prisma.rrhhEmpleado.deleteMany({});
  await prisma.invProducto.deleteMany({});
  await prisma.ventasPedidoDetalle.deleteMany({});
  await prisma.ventasPedido.deleteMany({});
  await prisma.ventasCliente.deleteMany({});
  await prisma.log_recepcion_detalle.deleteMany({});
  await prisma.log_recepcion.deleteMany({});
  await prisma.log_incidencia.deleteMany({});
  await prisma.log_bulto_detalle.deleteMany({});
  await prisma.log_estado_envio.deleteMany({});
  await prisma.inv_mov.deleteMany({});
  await prisma.log_evento_tracking.deleteMany({});
  await prisma.log_bulto.deleteMany({});
  await prisma.log_guia_despacho.deleteMany({});
  await prisma.log_ot_picking_detalle.deleteMany({});
  await prisma.log_ot_picking.deleteMany({});
  await prisma.log_direccion.deleteMany({});
  await prisma.log_tarifa.deleteMany({});
  await prisma.log_cobertura.deleteMany({});
  await prisma.log_comuna.deleteMany({});
  await prisma.log_region.deleteMany({});
  await prisma.log_servicio.deleteMany({});
  await prisma.log_transportista.deleteMany({});

  // 1. REGIONES (10 registros)
  console.log('📌 Insertando regiones...');
  const regionesData = [
    { id: 1, nombre: 'Arica y Parinacota' },
    { id: 2, nombre: 'Tarapacá' },
    { id: 3, nombre: 'Antofagasta' },
    { id: 4, nombre: 'Atacama' },
    { id: 5, nombre: 'Coquimbo (IV Región)' },
    { id: 6, nombre: 'Valparaíso' },
    { id: 7, nombre: 'Metropolitana de Santiago (RM)' },
    { id: 8, nombre: "O'Higgins" },
    { id: 9, nombre: 'Maule' },
    { id: 10, nombre: 'Biobío' },
  ];

  for (const r of regionesData) {
    await prisma.log_region.create({ data: r });
  }

  // 2. COMUNAS (12 registros - IV Región y RM)
  console.log('📌 Insertando comunas...');
  const comunasData = [
    // IV Región (id: 5)
    { id: 101, region_id: 5, nombre: 'La Serena' },
    { id: 102, region_id: 5, nombre: 'Coquimbo' },
    { id: 103, region_id: 5, nombre: 'Vicuña' },
    { id: 104, region_id: 5, nombre: 'Ovalle' },
    { id: 105, region_id: 5, nombre: 'Andacollo' },
    { id: 106, region_id: 5, nombre: 'Paihuano' },
    // RM (id: 7)
    { id: 201, region_id: 7, nombre: 'Santiago Centro' },
    { id: 202, region_id: 7, nombre: 'Las Condes' },
    { id: 203, region_id: 7, nombre: 'Maipú' },
    { id: 204, region_id: 7, nombre: 'Providencia' },
    { id: 205, region_id: 7, nombre: 'Puente Alto' },
    { id: 206, region_id: 7, nombre: 'Vitacura' },
  ];

  for (const c of comunasData) {
    await prisma.log_comuna.create({ data: c });
  }

  // 3. TRANSPORTISTAS (10 registros)
  console.log('📌 Insertando transportistas...');
  const transportistasData = [
    {
      id: 1,
      rut: '96.554.000-4',
      nombre: 'Chilexpress',
      contacto_email: 'integraciones@chilexpress.cl',
      contacto_telefono: '+56 2 2361 2000',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 2,
      rut: '96.882.110-K',
      nombre: 'Starken',
      contacto_email: 'empresas@starken.cl',
      contacto_telefono: '+56 2 2762 1000',
      factor_volumetrico_default: 4000,
      activo: true,
    },
    {
      id: 3,
      rut: '76.123.456-7',
      nombre: 'Blue Express',
      contacto_email: 'contacto@bluex.cl',
      contacto_telefono: '+56 2 2450 8000',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 4,
      rut: '70.012.300-9',
      nombre: 'Correos de Chile',
      contacto_email: 'atencion@correos.cl',
      contacto_telefono: '+56 2 2956 0000',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 5,
      rut: '76.998.877-1',
      nombre: 'Shippify Chile',
      contacto_email: 'ops@shippify.co',
      contacto_telefono: '+56 9 8765 4321',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 6,
      rut: '96.771.220-3',
      nombre: 'Transportes Varmontt',
      contacto_email: 'comercial@varmontt.cl',
      contacto_telefono: '+56 2 2680 9000',
      factor_volumetrico_default: 4000,
      activo: true,
    },
    {
      id: 7,
      rut: '96.345.670-8',
      nombre: 'Pullman Cargo',
      contacto_email: 'contacto@pullmancargo.cl',
      contacto_telefono: '+56 2 2720 0000',
      factor_volumetrico_default: 4000,
      activo: true,
    },
    {
      id: 8,
      rut: '77.200.100-2',
      nombre: 'FedEx Chile',
      contacto_email: 'chilesupport@fedex.com',
      contacto_telefono: '+56 2 2580 5000',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 9,
      rut: '76.444.555-0',
      nombre: 'DHL Express Chile',
      contacto_email: 'ventas@dhl.cl',
      contacto_telefono: '+56 2 2345 6789',
      factor_volumetrico_default: 5000,
      activo: true,
    },
    {
      id: 10,
      rut: '76.888.999-5',
      nombre: 'TNT Express',
      contacto_email: 'clientes@tnt.cl',
      contacto_telefono: '+56 2 2888 7777',
      factor_volumetrico_default: 5000,
      activo: false,
    },
  ];

  for (const t of transportistasData) {
    await prisma.log_transportista.create({ data: t });
  }

  // 4. SERVICIOS (11 registros)
  console.log('📌 Insertando servicios de transportistas...');
  const serviciosData = [
    { id: 1, transportista_id: 1, nombre: 'Chilexpress Prioritario (24h)', dias_transito_comprometidos: 1, activo: true },
    { id: 2, transportista_id: 1, nombre: 'Chilexpress Día Hábil Siguiente', dias_transito_comprometidos: 1, activo: true },
    { id: 3, transportista_id: 1, nombre: 'Chilexpress Extendido Terrestre', dias_transito_comprometidos: 3, activo: true },
    { id: 4, transportista_id: 2, nombre: 'Starken Normal a Domicilio', dias_transito_comprometidos: 2, activo: true },
    { id: 5, transportista_id: 2, nombre: 'Starken Express AM', dias_transito_comprometidos: 1, activo: true },
    { id: 6, transportista_id: 2, nombre: 'Starken Carga Especial Bulto Pesado', dias_transito_comprometidos: 3, activo: true },
    { id: 7, transportista_id: 3, nombre: 'Blue Express Prioritario', dias_transito_comprometidos: 1, activo: true },
    { id: 8, transportista_id: 3, nombre: 'Blue Express Estándar Nacional', dias_transito_comprometidos: 2, activo: true },
    { id: 9, transportista_id: 3, nombre: 'Blue Express Same-Day Express', dias_transito_comprometidos: 0, activo: true },
    { id: 10, transportista_id: 4, nombre: 'Correos Chile Paquete Domicilio', dias_transito_comprometidos: 3, activo: true },
    { id: 11, transportista_id: 8, nombre: 'FedEx Priority Overnight', dias_transito_comprometidos: 1, activo: true },
  ];

  for (const s of serviciosData) {
    await prisma.log_servicio.create({ data: s });
  }

  // 5. COBERTURAS (12 registros - con y sin cobertura para validar)
  console.log('📌 Insertando coberturas...');
  const hoy = new Date();
  const unAnoMas = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());
  const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
  const expirado = new Date(hoy.getFullYear(), hoy.getMonth() - 2, hoy.getDate());

  const coberturasData = [
    // Chilexpress Prioritario (servicio 1) tiene cobertura en La Serena, Coquimbo, Santiago, Las Condes, Maipú
    { id: 1, servicio_id: 1, comuna_id: 101, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // La Serena
    { id: 2, servicio_id: 1, comuna_id: 102, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Coquimbo
    { id: 3, servicio_id: 1, comuna_id: 103, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Vicuña
    { id: 4, servicio_id: 1, comuna_id: 201, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Santiago
    { id: 5, servicio_id: 1, comuna_id: 202, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Las Condes
    { id: 6, servicio_id: 1, comuna_id: 203, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Maipú
    // Starken Normal (servicio 4) en La Serena, Ovalle, Santiago, Providencia
    { id: 7, servicio_id: 4, comuna_id: 101, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // La Serena
    { id: 8, servicio_id: 4, comuna_id: 104, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Ovalle
    { id: 9, servicio_id: 4, comuna_id: 201, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Santiago
    { id: 10, servicio_id: 4, comuna_id: 204, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Providencia
    // Blue Express Prioritario (servicio 7) en La Serena, Coquimbo, Santiago
    { id: 11, servicio_id: 7, comuna_id: 101, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // La Serena
    { id: 12, servicio_id: 7, comuna_id: 201, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas, vigente: true }, // Santiago
    // Cobertura NO vigente para pruebas de validación (Andacollo y Paihuano sin cobertura vigente en servicio 1)
    { id: 13, servicio_id: 1, comuna_id: 105, vigencia_desde: expirado, vigencia_hasta: haceUnMes, vigente: false }, // Andacollo vencida
    { id: 14, servicio_id: 7, comuna_id: 106, vigencia_desde: expirado, vigencia_hasta: haceUnMes, vigente: false }, // Paihuano vencida
  ];

  for (const c of coberturasData) {
    await prisma.log_cobertura.create({ data: c });
  }

  // 6. TARIFAS (12 registros)
  console.log('📌 Insertando tarifas...');
  const tarifasData = [
    { id: 1, servicio_id: 1, comuna_id: 101, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 4500, precio_kg_adicional: 1200, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 2, servicio_id: 1, comuna_id: 102, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 4700, precio_kg_adicional: 1200, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 3, servicio_id: 1, comuna_id: 103, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 5900, precio_kg_adicional: 1500, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 4, servicio_id: 1, comuna_id: 201, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 3900, precio_kg_adicional: 900, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 5, servicio_id: 1, comuna_id: 202, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 4200, precio_kg_adicional: 950, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 6, servicio_id: 1, comuna_id: 203, peso_desde_kg: 0.0, peso_hasta_kg: 3.0, precio_base: 4100, precio_kg_adicional: 950, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 7, servicio_id: 4, comuna_id: 101, peso_desde_kg: 0.0, peso_hasta_kg: 5.0, precio_base: 4200, precio_kg_adicional: 1100, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 8, servicio_id: 4, comuna_id: 104, peso_desde_kg: 0.0, peso_hasta_kg: 5.0, precio_base: 5100, precio_kg_adicional: 1300, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 9, servicio_id: 4, comuna_id: 201, peso_desde_kg: 0.0, peso_hasta_kg: 5.0, precio_base: 3600, precio_kg_adicional: 850, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 10, servicio_id: 7, comuna_id: 101, peso_desde_kg: 0.0, peso_hasta_kg: 2.0, precio_base: 3800, precio_kg_adicional: 1000, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 11, servicio_id: 7, comuna_id: 201, peso_desde_kg: 0.0, peso_hasta_kg: 2.0, precio_base: 3500, precio_kg_adicional: 800, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
    { id: 12, servicio_id: 8, comuna_id: 201, peso_desde_kg: 0.0, peso_hasta_kg: 5.0, precio_base: 3200, precio_kg_adicional: 750, vigencia_desde: haceUnMes, vigencia_hasta: unAnoMas },
  ];

  for (const t of tarifasData) {
    await prisma.log_tarifa.create({ data: t });
  }

  // 7. DIRECCIONES DE CLIENTES (11 registros)
  console.log('📌 Insertando direcciones de clientes...');
  const direccionesData = [
    { id: 1, cliente_id: 1001, cliente_nombre: 'Martín Almeyda', cliente_rut: '17.291.844-3', comuna_id: 101, calle: 'Av. Cuatro Esquinas', numero: '1420', depto: 'Torre B, Depto 402', referencia: 'Cerca del Mall Plaza La Serena', activa: true },
    { id: 2, cliente_id: 1002, cliente_nombre: 'Constanza Valenzuela', cliente_rut: '18.452.910-1', comuna_id: 102, calle: 'Calle Baquedano', numero: '550', depto: null, referencia: 'Frente a Plaza de Armas de Coquimbo', activa: true },
    { id: 3, cliente_id: 1003, cliente_nombre: 'Felipe Quiroz', cliente_rut: '15.632.189-5', comuna_id: 103, calle: 'Gabriela Mistral', numero: '280', depto: 'Casa 3', referencia: 'Cerca del Museo de Vicuña', activa: true },
    { id: 4, cliente_id: 1004, cliente_nombre: 'Bárbara Henríquez', cliente_rut: '19.821.432-8', comuna_id: 104, calle: 'Ariztía Poniente', numero: '915', depto: null, referencia: 'Sector Feria Modelo Ovalle', activa: true },
    { id: 5, cliente_id: 1005, cliente_nombre: 'Rodrigo Saavedra', cliente_rut: '16.112.784-K', comuna_id: 201, calle: 'Moneda', numero: '1040', depto: 'Oficina 601', referencia: 'A pasos del Metro Moneda', activa: true },
    { id: 6, cliente_id: 1006, cliente_nombre: 'Camila Montecinos', cliente_rut: '18.990.231-7', comuna_id: 202, calle: 'Av. Apoquindo', numero: '4800', depto: 'Depto 1204', referencia: 'Cerca de Escuela Militar', activa: true },
    { id: 7, cliente_id: 1007, cliente_nombre: 'Ignacio Cifuentes', cliente_rut: '17.845.620-2', comuna_id: 203, calle: 'Av. Pajaritos', numero: '3100', depto: 'Block 4, Depto 21', referencia: 'Metro Plaza de Maipú', activa: true },
    { id: 8, cliente_id: 1008, cliente_nombre: 'Valentina Soto', cliente_rut: '19.412.380-6', comuna_id: 204, calle: 'Av. Pedro de Valdivia', numero: '1250', depto: 'Casa 8', referencia: 'Condominio Los Plátanos', activa: true },
    { id: 9, cliente_id: 1009, cliente_nombre: 'Sebastián Lagos', cliente_rut: '16.782.901-4', comuna_id: 205, calle: 'Concha y Toro', numero: '890', depto: 'Depto 302', referencia: 'Frente a Municipalidad Puente Alto', activa: true },
    { id: 10, cliente_id: 1010, cliente_nombre: 'Paulina Morales', cliente_rut: '17.654.321-0', comuna_id: 206, calle: 'Av. Vitacura', numero: '3565', depto: 'Penthouse A', referencia: 'Sector Bicentenario', activa: true },
    // Dirección en comuna sin cobertura activa para pruebas (Andacollo)
    { id: 11, cliente_id: 1011, cliente_nombre: 'Gastón Araya (Comuna Sin Cobertura)', cliente_rut: '14.980.123-9', comuna_id: 105, calle: 'Calle Urmeneta', numero: '120', depto: null, referencia: 'Andacollo Centro', activa: true },
  ];

  for (const d of direccionesData) {
    await prisma.log_direccion.create({ data: d });
  }

  // 8. ÓRDENES DE TRABAJO (OT PICKING) (12 registros con variados estados)
  console.log('📌 Insertando órdenes de trabajo de picking (OT)...');
  const otsData = [
    {
      id: 'OT-4091',
      id_pedido: 'PED-10294',
      id_operador: 301,
      nombre_operador: 'Carlos Gómez (Bodega Central)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1001,
      cliente_nombre: 'Martín Almeyda',
      cliente_rut: '17.291.844-3',
      direccion_id: 1,
      fecha_creacion: new Date(Date.now() - 3600000 * 24 * 3),
    },
    {
      id: 'OT-4092',
      id_pedido: 'PED-10295',
      id_operador: 302,
      nombre_operador: 'Juan Tapia (Picking Zona Norte)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1002,
      cliente_nombre: 'Constanza Valenzuela',
      cliente_rut: '18.452.910-1',
      direccion_id: 2,
      fecha_creacion: new Date(Date.now() - 3600000 * 24 * 2.5),
    },
    {
      id: 'OT-4093',
      id_pedido: 'PED-10296',
      id_operador: 301,
      nombre_operador: 'Carlos Gómez (Bodega Central)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1003,
      cliente_nombre: 'Felipe Quiroz',
      cliente_rut: '15.632.189-5',
      direccion_id: 3,
      fecha_creacion: new Date(Date.now() - 3600000 * 24 * 2),
    },
    {
      id: 'OT-4094',
      id_pedido: 'PED-10297',
      id_operador: 303,
      nombre_operador: 'Loreto Silva (Bodega Packing)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1005,
      cliente_nombre: 'Rodrigo Saavedra',
      cliente_rut: '16.112.784-K',
      direccion_id: 5,
      fecha_creacion: new Date(Date.now() - 3600000 * 24 * 1.5),
    },
    {
      id: 'OT-4095',
      id_pedido: 'PED-10298',
      id_operador: 302,
      nombre_operador: 'Juan Tapia (Picking Zona Norte)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1006,
      cliente_nombre: 'Camila Montecinos',
      cliente_rut: '18.990.231-7',
      direccion_id: 6,
      fecha_creacion: new Date(Date.now() - 3600000 * 24 * 1),
    },
    {
      id: 'OT-4096',
      id_pedido: 'PED-10299',
      id_operador: 304,
      nombre_operador: 'Esteban Paredes (Logística)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1007,
      cliente_nombre: 'Ignacio Cifuentes',
      cliente_rut: '17.845.620-2',
      direccion_id: 7,
      fecha_creacion: new Date(Date.now() - 3600000 * 18),
    },
    {
      id: 'OT-4097',
      id_pedido: 'PED-10300',
      id_operador: 301,
      nombre_operador: 'Carlos Gómez (Bodega Central)',
      estado: EstadoOT.PENDIENTE,
      cliente_id: 1004,
      cliente_nombre: 'Bárbara Henríquez',
      cliente_rut: '19.821.432-8',
      direccion_id: 4,
      fecha_creacion: new Date(Date.now() - 3600000 * 12),
    },
    {
      id: 'OT-4098',
      id_pedido: 'PED-10301',
      id_operador: 302,
      nombre_operador: 'Juan Tapia (Picking Zona Norte)',
      estado: EstadoOT.PARCIAL,
      cliente_id: 1008,
      cliente_nombre: 'Valentina Soto',
      cliente_rut: '19.412.380-6',
      direccion_id: 8,
      fecha_creacion: new Date(Date.now() - 3600000 * 8),
    },
    {
      id: 'OT-4099',
      id_pedido: 'PED-10302',
      id_operador: 303,
      nombre_operador: 'Loreto Silva (Bodega Packing)',
      estado: EstadoOT.EN_PROCESO,
      cliente_id: 1009,
      cliente_nombre: 'Sebastián Lagos',
      cliente_rut: '16.782.901-4',
      direccion_id: 9,
      fecha_creacion: new Date(Date.now() - 3600000 * 4),
    },
    {
      id: 'OT-4100',
      id_pedido: 'PED-10303',
      id_operador: 304,
      nombre_operador: 'Esteban Paredes (Logística)',
      estado: EstadoOT.PENDIENTE,
      cliente_id: 1010,
      cliente_nombre: 'Paulina Morales',
      cliente_rut: '17.654.321-0',
      direccion_id: 10,
      fecha_creacion: new Date(Date.now() - 3600000 * 2),
    },
    // OT con dirección sin cobertura activa (para test de validación 2)
    {
      id: 'OT-4101',
      id_pedido: 'PED-10304',
      id_operador: 301,
      nombre_operador: 'Carlos Gómez (Bodega Central)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1011,
      cliente_nombre: 'Gastón Araya (Comuna Sin Cobertura)',
      cliente_rut: '14.980.123-9',
      direccion_id: 11,
      fecha_creacion: new Date(Date.now() - 3600000 * 6),
    },
    {
      id: 'OT-4102',
      id_pedido: 'PED-10305',
      id_operador: 303,
      nombre_operador: 'Loreto Silva (Bodega Packing)',
      estado: EstadoOT.CERRADO,
      cliente_id: 1001,
      cliente_nombre: 'Martín Almeyda',
      cliente_rut: '17.291.844-3',
      direccion_id: 1,
      fecha_creacion: new Date(Date.now() - 3600000 * 1),
    },
  ];

  for (const ot of otsData) {
    await prisma.log_ot_picking.create({ data: ot });
  }

  // 9. DETALLE OT PICKING (Catálogo de sets LEGO emblemáticos - 14 registros)
  console.log('📌 Insertando detalle de productos LEGO en órdenes de trabajo...');
  const detallesData = [
    // OT-4091: Millennium Falcon (UCS)
    { id: 1, ot_id: 'OT-4091', id_producto: 75192, sku: 'LEGO-SW-75192', nombre_producto: 'LEGO Star Wars Millennium Falcon UCS', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 13.2, largo_cm: 53.0, alto_cm: 46.0, ancho_cm: 38.0 },
    // OT-4092: AT-AT + Batmobile Tumbler
    { id: 2, ot_id: 'OT-4092', id_producto: 75288, sku: 'LEGO-SW-75288', nombre_producto: 'LEGO Star Wars AT-AT Walker', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.1, largo_cm: 48.0, alto_cm: 37.8, ancho_cm: 9.4 },
    { id: 3, ot_id: 'OT-4092', id_producto: 76240, sku: 'LEGO-DC-76240', nombre_producto: 'LEGO DC Batman Batmobile Tumbler', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.8, largo_cm: 45.0, alto_cm: 30.0, ancho_cm: 15.0 },
    // OT-4093: Ninjago City Gardens
    { id: 4, ot_id: 'OT-4093', id_producto: 71741, sku: 'LEGO-NJ-71741', nombre_producto: 'LEGO Ninjago City Gardens', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 5.6, largo_cm: 58.2, alto_cm: 48.0, ancho_cm: 17.0 },
    // OT-4094: Titanic
    { id: 5, ot_id: 'OT-4094', id_producto: 10294, sku: 'LEGO-IC-10294', nombre_producto: 'LEGO Icons Titanic (9090 piezas)', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 14.5, largo_cm: 60.0, alto_cm: 50.0, ancho_cm: 40.0 },
    // OT-4095: Hogwarts Castle
    { id: 6, ot_id: 'OT-4095', id_producto: 71043, sku: 'LEGO-HP-71043', nombre_producto: 'LEGO Harry Potter Castillo de Hogwarts', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 7.5, largo_cm: 60.0, alto_cm: 51.0, ancho_cm: 20.0 },
    // OT-4096: NASA Space Shuttle Discovery
    { id: 7, ot_id: 'OT-4096', id_producto: 10283, sku: 'LEGO-IC-10283', nombre_producto: 'LEGO NASA Space Shuttle Discovery', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 3.2, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 11.0 },
    // OT-4097 (Pendiente): Porsche 911
    { id: 8, ot_id: 'OT-4097', id_producto: 10295, sku: 'LEGO-IC-10295', nombre_producto: 'LEGO Icons Porsche 911 Turbo & Targa', cant_solicitada: 2, cant_recolectada: 0, peso_unitario_kg: 1.8, largo_cm: 48.0, alto_cm: 28.2, ancho_cm: 11.8 },
    // OT-4098 (Parcial): Police Station + Camp Nou
    { id: 9, ot_id: 'OT-4098', id_producto: 10278, sku: 'LEGO-MD-10278', nombre_producto: 'LEGO Modular Police Station', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.9, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 11.0 },
    { id: 10, ot_id: 'OT-4098', id_producto: 10284, sku: 'LEGO-IC-10284', nombre_producto: 'LEGO Icons Camp Nou FC Barcelona', cant_solicitada: 1, cant_recolectada: 0, peso_unitario_kg: 5.3, largo_cm: 58.0, alto_cm: 48.0, ancho_cm: 17.0 },
    // OT-4099 (En Proceso): Eiffel Tower
    { id: 11, ot_id: 'OT-4099', id_producto: 10307, sku: 'LEGO-IC-10307', nombre_producto: 'LEGO Icons Torre Eiffel (149 cm)', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 12.0, largo_cm: 62.0, alto_cm: 52.0, ancho_cm: 39.0 },
    // OT-4100 (Pendiente): Ideas Grand Piano
    { id: 12, ot_id: 'OT-4100', id_producto: 21323, sku: 'LEGO-ID-21323', nombre_producto: 'LEGO Ideas Grand Piano Motorizado', cant_solicitada: 1, cant_recolectada: 0, peso_unitario_kg: 5.8, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 16.0 },
    // OT-4101: Batman Batmobile
    { id: 13, ot_id: 'OT-4101', id_producto: 76240, sku: 'LEGO-DC-76240', nombre_producto: 'LEGO DC Batman Batmobile Tumbler', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.8, largo_cm: 45.0, alto_cm: 30.0, ancho_cm: 15.0 },
    // OT-4102: AT-AT Walker
    { id: 14, ot_id: 'OT-4102', id_producto: 75288, sku: 'LEGO-SW-75288', nombre_producto: 'LEGO Star Wars AT-AT Walker', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.1, largo_cm: 48.0, alto_cm: 37.8, ancho_cm: 9.4 },
  ];

  for (const det of detallesData) {
    await prisma.log_ot_picking_detalle.create({ data: det });
  }

  // 10. GUÍAS DE DESPACHO (10 registros emitidos previamente con histórico)
  console.log('📌 Insertando guías de despacho emitidas...');
  const guiasData = [
    {
      id: 'GD-52301',
      ot_id: 'OT-4091',
      transportista_id: 1, // Chilexpress
      servicio_id: 1,
      direccion_id: 1,
      num_seguimiento: 'CHX-774091-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 13.2,
      peso_volumetrico_total_kg: 18.53, // (53*46*38)/5000 = 18.53
      costo_envio: 22400,
      estado_actual: 'Entregado conforme',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 4),
    },
    {
      id: 'GD-52302',
      ot_id: 'OT-4092',
      transportista_id: 1,
      servicio_id: 2,
      direccion_id: 2,
      num_seguimiento: 'CHX-774092-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 4.9,
      peso_volumetrico_total_kg: 7.45,
      costo_envio: 9800,
      estado_actual: 'Entrega Fallida',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 3.5),
    },
    {
      id: 'GD-52303',
      ot_id: 'OT-4093',
      transportista_id: 2, // Starken
      servicio_id: 4,
      direccion_id: 3,
      num_seguimiento: 'STK-884093-CL',
      factor_volumetrico_aplicado: 4000,
      peso_real_total_kg: 5.6,
      peso_volumetrico_total_kg: 11.87,
      costo_envio: 14500,
      estado_actual: 'En tránsito',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 2.8),
    },
    {
      id: 'GD-52304',
      ot_id: 'OT-4094',
      transportista_id: 1,
      servicio_id: 1,
      direccion_id: 5,
      num_seguimiento: 'CHX-774094-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 14.5,
      peso_volumetrico_total_kg: 24.0,
      costo_envio: 26000,
      estado_actual: 'Despachado',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 2),
    },
    {
      id: 'GD-52305',
      ot_id: 'OT-4095',
      transportista_id: 3, // Blue Express
      servicio_id: 7,
      direccion_id: 6,
      num_seguimiento: 'BLU-994095-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 7.5,
      peso_volumetrico_total_kg: 12.24,
      costo_envio: 15300,
      estado_actual: 'En tránsito',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 1.5),
    },
    {
      id: 'GD-52306',
      ot_id: 'OT-4096',
      transportista_id: 1,
      servicio_id: 1,
      direccion_id: 7,
      num_seguimiento: 'CHX-774096-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 3.2,
      peso_volumetrico_total_kg: 4.72,
      costo_envio: 6900,
      estado_actual: 'Preparado',
      fecha_emision: new Date(Date.now() - 3600000 * 20),
    },
    {
      id: 'GD-52307',
      ot_id: 'OT-4091',
      transportista_id: 2,
      servicio_id: 4,
      direccion_id: 1,
      num_seguimiento: 'STK-884097-CL',
      factor_volumetrico_aplicado: 4000,
      peso_real_total_kg: 13.2,
      peso_volumetrico_total_kg: 23.16,
      costo_envio: 24500,
      estado_actual: 'Entregado conforme',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 6),
    },
    {
      id: 'GD-52308',
      ot_id: 'OT-4093',
      transportista_id: 1,
      servicio_id: 1,
      direccion_id: 3,
      num_seguimiento: 'CHX-774098-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 5.6,
      peso_volumetrico_total_kg: 9.5,
      costo_envio: 12800,
      estado_actual: 'Entregado conforme',
      fecha_emision: new Date(Date.now() - 3600000 * 24 * 7),
    },
    {
      id: 'GD-52309',
      ot_id: 'OT-4092',
      transportista_id: 3,
      servicio_id: 7,
      direccion_id: 2,
      num_seguimiento: 'BLU-994099-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 4.9,
      peso_volumetrico_total_kg: 6.8,
      costo_envio: 8900,
      estado_actual: 'Despachado',
      fecha_emision: new Date(Date.now() - 3600000 * 14),
    },
    {
      id: 'GD-52310',
      ot_id: 'OT-4095',
      transportista_id: 1,
      servicio_id: 1,
      direccion_id: 6,
      num_seguimiento: 'CHX-774100-CL',
      factor_volumetrico_aplicado: 5000,
      peso_real_total_kg: 7.5,
      peso_volumetrico_total_kg: 12.24,
      costo_envio: 14200,
      estado_actual: 'Preparado',
      fecha_emision: new Date(Date.now() - 3600000 * 5),
    },
  ];

  for (const g of guiasData) {
    await prisma.log_guia_despacho.create({ data: g });
  }

  // 11. BULTOS (12 registros)
  console.log('📌 Insertando bultos para las guías...');
  const bultosData = [
    { id: 1, guia_id: 'GD-52301', largo_cm: 53.0, alto_cm: 46.0, ancho_cm: 38.0, peso_real_kg: 13.2, peso_volumetrico_kg: 18.53 },
    { id: 2, guia_id: 'GD-52302', largo_cm: 48.0, alto_cm: 37.8, ancho_cm: 18.0, peso_real_kg: 4.9, peso_volumetrico_kg: 7.45 },
    { id: 3, guia_id: 'GD-52303', largo_cm: 58.2, alto_cm: 48.0, ancho_cm: 17.0, peso_real_kg: 5.6, peso_volumetrico_kg: 11.87 },
    { id: 4, guia_id: 'GD-52304', largo_cm: 60.0, alto_cm: 50.0, ancho_cm: 40.0, peso_real_kg: 14.5, peso_volumetrico_kg: 24.0 },
    { id: 5, guia_id: 'GD-52305', largo_cm: 60.0, alto_cm: 51.0, ancho_cm: 20.0, peso_real_kg: 7.5, peso_volumetrico_kg: 12.24 },
    { id: 6, guia_id: 'GD-52306', largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 11.0, peso_real_kg: 3.2, peso_volumetrico_kg: 4.72 },
    { id: 7, guia_id: 'GD-52307', largo_cm: 53.0, alto_cm: 46.0, ancho_cm: 38.0, peso_real_kg: 13.2, peso_volumetrico_kg: 23.16 },
    { id: 8, guia_id: 'GD-52308', largo_cm: 58.2, alto_cm: 48.0, ancho_cm: 17.0, peso_real_kg: 5.6, peso_volumetrico_kg: 9.5 },
    { id: 9, guia_id: 'GD-52309', largo_cm: 48.0, alto_cm: 37.8, ancho_cm: 18.0, peso_real_kg: 4.9, peso_volumetrico_kg: 6.8 },
    { id: 10, guia_id: 'GD-52310', largo_cm: 60.0, alto_cm: 51.0, ancho_cm: 20.0, peso_real_kg: 7.5, peso_volumetrico_kg: 12.24 },
  ];

  for (const b of bultosData) {
    await prisma.log_bulto.create({ data: b });
  }

  // 12. EVENTOS DE TRACKING (Bitácora de solo inserción - >25 registros cronológicos)
  console.log('📌 Insertando bitácora de eventos de tracking...');
  const eventosData = [
    // GD-52301 (Entregado conforme)
    { guia_id: 'GD-52301', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 4), usuario_responsable: 'M. Pizarro', observacion: 'Bulto embalado y etiquetado con sello de seguridad LEGO' },
    { guia_id: 'GD-52301', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.8), usuario_responsable: 'C. Gómez', observacion: 'Entregado a móvil Chilexpress ruta Norte' },
    { guia_id: 'GD-52301', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.2), usuario_responsable: 'Chilexpress HUB', observacion: 'Arribo a centro de distribución La Serena' },
    { guia_id: 'GD-52301', estado: 'Entregado conforme', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.8), usuario_responsable: 'Conductor Chilexpress', observacion: 'Recibido por conserjería edificio, firma conforme' },

    // GD-52302 (Entrega Fallida)
    { guia_id: 'GD-52302', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.5), usuario_responsable: 'M. Pizarro', observacion: 'Emisión de guía y verificación de contenido' },
    { guia_id: 'GD-52302', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.1), usuario_responsable: 'J. Tapia', observacion: 'Carga retirada por móvil' },
    { guia_id: 'GD-52302', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.5), usuario_responsable: 'Chilexpress HUB', observacion: 'En reparto hacia domicilio en Coquimbo' },
    { guia_id: 'GD-52302', estado: 'Entrega Fallida', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.1), usuario_responsable: 'Conductor Chilexpress', observacion: 'Primer intento fallido: Domicilio cerrado sin timbre ni moradores' },

    // GD-52303 (En tránsito)
    { guia_id: 'GD-52303', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.8), usuario_responsable: 'M. Pizarro', observacion: 'Bulto con protección de esquinas rígidas' },
    { guia_id: 'GD-52303', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.2), usuario_responsable: 'L. Silva', observacion: 'Entregado a transporte Starken' },
    { guia_id: 'GD-52303', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.2), usuario_responsable: 'Starken HUB Ovalle', observacion: 'En transferencia hacia sucursal Vicuña' },

    // GD-52304 (Despachado)
    { guia_id: 'GD-52304', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2), usuario_responsable: 'M. Pizarro', observacion: 'Caja doble corrugado para Set Titanic' },
    { guia_id: 'GD-52304', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.5), usuario_responsable: 'C. Gómez', observacion: 'Retirado por Chilexpress en bodega central' },

    // GD-52305 (En tránsito)
    { guia_id: 'GD-52305', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.5), usuario_responsable: 'M. Pizarro', observacion: 'Revisión final de SKU y etiqueta de fragilidad' },
    { guia_id: 'GD-52305', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.1), usuario_responsable: 'J. Tapia', observacion: 'Entregado a Blue Express' },
    { guia_id: 'GD-52305', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 16), usuario_responsable: 'Blue Express Hub Pudahuel', observacion: 'Clasificado en sorter automático sector Oriente' },

    // GD-52306 (Preparado)
    { guia_id: 'GD-52306', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 20), usuario_responsable: 'M. Pizarro', observacion: 'Guía emitida, esperando retiro programado de las 18:00' },

    // GD-52307 (Entregado conforme)
    { guia_id: 'GD-52307', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 6), usuario_responsable: 'M. Pizarro', observacion: 'Despacho verificado' },
    { guia_id: 'GD-52307', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 5.8), usuario_responsable: 'L. Silva', observacion: 'Retirado por Starken' },
    { guia_id: 'GD-52307', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 5.2), usuario_responsable: 'Starken La Serena', observacion: 'En reparto' },
    { guia_id: 'GD-52307', estado: 'Entregado conforme', fecha_hora: new Date(Date.now() - 3600000 * 24 * 4.9), usuario_responsable: 'Conductor Starken', observacion: 'Entregado a cliente titular Martín Almeyda' },

    // GD-52308 (Entregado conforme)
    { guia_id: 'GD-52308', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 7), usuario_responsable: 'M. Pizarro', observacion: 'Emisión exitosa' },
    { guia_id: 'GD-52308', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 6.8), usuario_responsable: 'C. Gómez', observacion: 'En camino' },
    { guia_id: 'GD-52308', estado: 'Entregado conforme', fecha_hora: new Date(Date.now() - 3600000 * 24 * 6.1), usuario_responsable: 'Conductor Chilexpress', observacion: 'Entregado sin novedades' },

    // GD-52309 (Despachado)
    { guia_id: 'GD-52309', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 14), usuario_responsable: 'M. Pizarro', observacion: 'Emisión lista' },
    { guia_id: 'GD-52309', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 10), usuario_responsable: 'J. Tapia', observacion: 'Retirado por móvil Blue Express' },

    // GD-52310 (Preparado)
    { guia_id: 'GD-52310', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 5), usuario_responsable: 'M. Pizarro', observacion: 'Listo en muelle de carga A' },
  ];

  for (const ev of eventosData) {
    await prisma.log_evento_tracking.create({ data: ev });
  }

  // 13. MOVIMIENTOS DE INVENTARIO (inv_mov) (12 registros de salida por despacho)
  console.log('📌 Insertando movimientos de inventario...');
  const invMovsData = [
    { id_producto: 75192, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52301 / OT-4091', fecha: new Date(Date.now() - 3600000 * 24 * 4) },
    { id_producto: 75288, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52302 / OT-4092', fecha: new Date(Date.now() - 3600000 * 24 * 3.5) },
    { id_producto: 76240, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52302 / OT-4092', fecha: new Date(Date.now() - 3600000 * 24 * 3.5) },
    { id_producto: 71741, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52303 / OT-4093', fecha: new Date(Date.now() - 3600000 * 24 * 2.8) },
    { id_producto: 10294, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52304 / OT-4094', fecha: new Date(Date.now() - 3600000 * 24 * 2) },
    { id_producto: 71043, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52305 / OT-4095', fecha: new Date(Date.now() - 3600000 * 24 * 1.5) },
    { id_producto: 10283, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52306 / OT-4096', fecha: new Date(Date.now() - 3600000 * 20) },
    { id_producto: 75192, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52307 / OT-4091', fecha: new Date(Date.now() - 3600000 * 24 * 6) },
    { id_producto: 71741, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52308 / OT-4093', fecha: new Date(Date.now() - 3600000 * 24 * 7) },
    { id_producto: 75288, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52309 / OT-4092', fecha: new Date(Date.now() - 3600000 * 14) },
    { id_producto: 71043, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52310 / OT-4095', fecha: new Date(Date.now() - 3600000 * 5) },
    { id_producto: 10278, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-HIST-001', fecha: new Date(Date.now() - 3600000 * 24 * 10) },
  ];

  for (const m of invMovsData) {
    await prisma.inv_mov.create({ data: m });
  }

  // 14. ESTADOS DE ENVÍO (log_estado_envio) (10 registros)
  console.log('📌 Insertando catálogo de estados de envío...');
  const estadosEnvioData = [
    { id: 1, codigo: 'PREPARADO', nombre: 'Preparado', orden_flujo: 1, es_terminal: false },
    { id: 2, codigo: 'ASIGNADO', nombre: 'Asignado', orden_flujo: 2, es_terminal: false },
    { id: 3, codigo: 'DESPACHADO', nombre: 'Despachado', orden_flujo: 3, es_terminal: false },
    { id: 4, codigo: 'EN_TRANSITO', nombre: 'En tránsito', orden_flujo: 4, es_terminal: false },
    { id: 5, codigo: 'EN_REPARTO', nombre: 'En reparto última milla', orden_flujo: 5, es_terminal: false },
    { id: 6, codigo: 'ENTREGADO_CONFORME', nombre: 'Entregado conforme', orden_flujo: 6, es_terminal: true },
    { id: 7, codigo: 'ENTREGA_FALLIDA', nombre: 'Entrega Fallida', orden_flujo: 7, es_terminal: false },
    { id: 8, codigo: 'REPROGRAMADO', nombre: 'Reprogramado', orden_flujo: 8, es_terminal: false },
    { id: 9, codigo: 'DEVUELTO', nombre: 'Devuelto a bodega', orden_flujo: 9, es_terminal: true },
    { id: 10, codigo: 'DERIVADO_POSTVENTA', nombre: 'Derivado a Postventa', orden_flujo: 10, es_terminal: true },
  ];
  for (const est of estadosEnvioData) {
    await prisma.log_estado_envio.create({ data: est });
  }

  // 15. DETALLE DE BULTOS (log_bulto_detalle) (10 registros)
  console.log('📌 Insertando detalle de bultos...');
  const bultosDetalleData = [
    { id: 1, bulto_id: 1, ot_detalle_id: 1, cantidad: 1 },
    { id: 2, bulto_id: 2, ot_detalle_id: 2, cantidad: 1 },
    { id: 3, bulto_id: 2, ot_detalle_id: 3, cantidad: 1 },
    { id: 4, bulto_id: 3, ot_detalle_id: 4, cantidad: 1 },
    { id: 5, bulto_id: 4, ot_detalle_id: 5, cantidad: 1 },
    { id: 6, bulto_id: 5, ot_detalle_id: 6, cantidad: 1 },
    { id: 7, bulto_id: 6, ot_detalle_id: 7, cantidad: 1 },
    { id: 8, bulto_id: 7, ot_detalle_id: 1, cantidad: 1 },
    { id: 9, bulto_id: 8, ot_detalle_id: 4, cantidad: 1 },
    { id: 10, bulto_id: 9, ot_detalle_id: 2, cantidad: 1 },
    { id: 11, bulto_id: 10, ot_detalle_id: 6, cantidad: 1 },
  ];
  for (const bd of bultosDetalleData) {
    await prisma.log_bulto_detalle.create({ data: bd });
  }

  // 16. INCIDENCIAS DE DESPACHO (log_incidencia) (10 registros)
  console.log('📌 Insertando incidencias de transporte...');
  const incidenciasData = [
    { id: 1, guia_id: 'GD-52302', tipo: 'DOMICILIO_CERRADO', descripcion: 'Primer intento fallido: Domicilio cerrado sin moradores en Coquimbo', id_caso_postventa: 5001, resuelta: false },
    { id: 2, guia_id: 'GD-52303', tipo: 'RETRASO_RUTA', descripcion: 'Demora en ruta C-41 hacia Vicuña por controles viales', id_caso_postventa: null, resuelta: true },
    { id: 3, guia_id: 'GD-52304', tipo: 'REVISION_EMPAQUE', descripcion: 'Refuerzo de esquina en centro de distribución para caja LEGO Titanic', id_caso_postventa: null, resuelta: true },
    { id: 4, guia_id: 'GD-52305', tipo: 'ALTA_DEMANDA_HUB', descripcion: 'Retención temporal de 4h en sorter automático Pudahuel', id_caso_postventa: null, resuelta: true },
    { id: 5, guia_id: 'GD-52301', tipo: 'CAMBIO_RECEPTOR', descripcion: 'Autorización telefónica para recepción en conserjería', id_caso_postventa: null, resuelta: true },
    { id: 6, guia_id: 'GD-52306', tipo: 'RETIRO_REPROGRAMADO', descripcion: 'Móvil recolector reprogramado para ventana PM', id_caso_postventa: null, resuelta: false },
    { id: 7, guia_id: 'GD-52307', tipo: 'DIRECCION_INCOMPLETA', descripcion: 'Aclaración de número de torre con cliente previo a entrega', id_caso_postventa: 5002, resuelta: true },
    { id: 8, guia_id: 'GD-52308', tipo: 'CLIMA_ADVERSO', descripcion: 'Neblina densa en ruta costera retrasó salida matinal', id_caso_postventa: null, resuelta: true },
    { id: 9, guia_id: 'GD-52309', tipo: 'ETIQUETA_REIMPRESA', descripcion: 'Código de barras reimpreso en andén de salida', id_caso_postventa: null, resuelta: true },
    { id: 10, guia_id: 'GD-52310', tipo: 'SOBREDIMENSION', descripcion: 'Asignado a furgón de carga volumétrica especial', id_caso_postventa: null, resuelta: true },
  ];
  for (const inc of incidenciasData) {
    await prisma.log_incidencia.create({ data: inc });
  }

  // 17. RECEPCIONES DE ÓRDENES DE COMPRA (log_recepcion y log_recepcion_detalle) (10 registros c/u)
  console.log('📌 Insertando recepciones de órdenes de compra y su detalle...');
  const recepcionesData = [
    { id: 1, id_oc: 8001, id_empleado_receptor: 301, estado: 'CONFORME', observacion: 'Recepción completa lote Star Wars UCS sin daños' },
    { id: 2, id_oc: 8002, id_empleado_receptor: 302, estado: 'CON_OBSERVACIONES', observacion: '1 caja con abolladura leve en esquina' },
    { id: 3, id_oc: 8003, id_empleado_receptor: 303, estado: 'CONFORME', observacion: 'Ingreso línea LEGO Icons verificado al 100%' },
    { id: 4, id_oc: 8004, id_empleado_receptor: 301, estado: 'PARCIAL', observacion: 'Faltaron 2 unidades de LEGO Camp Nou respecto a guía proveedor' },
    { id: 5, id_oc: 8005, id_empleado_receptor: 304, estado: 'CONFORME', observacion: 'Pallet sellado de fábrica LEGO Dinamarca' },
    { id: 6, id_oc: 8006, id_empleado_receptor: 302, estado: 'CONFORME', observacion: 'Recepción conforme línea Harry Potter' },
    { id: 7, id_oc: 8007, id_empleado_receptor: 303, estado: 'CON_OBSERVACIONES', observacion: 'Sello de seguridad húmedo en 1 unidad' },
    { id: 8, id_oc: 8008, id_empleado_receptor: 301, estado: 'CONFORME', observacion: 'Lote Ninjago ingresado a rack A-12' },
    { id: 9, id_oc: 8009, id_empleado_receptor: 304, estado: 'CONFORME', observacion: 'Reposición stock seguridad temporada Q4' },
    { id: 10, id_oc: 8010, id_empleado_receptor: 302, estado: 'CONFORME', observacion: 'Recepción validada por código EAN' },
  ];
  for (const rec of recepcionesData) {
    await prisma.log_recepcion.create({ data: rec });
  }

  const recepcionesDetalleData = [
    { id: 1, recepcion_id: 1, id_producto: 75192, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 0, motivo_dano: null },
    { id: 2, recepcion_id: 2, id_producto: 75288, cantidad_esperada: 15, cantidad_recibida: 15, cantidad_danada: 1, motivo_dano: 'Caja aplastada en esquina superior' },
    { id: 3, recepcion_id: 3, id_producto: 10294, cantidad_esperada: 8, cantidad_recibida: 8, cantidad_danada: 0, motivo_dano: null },
    { id: 4, recepcion_id: 4, id_producto: 10284, cantidad_esperada: 12, cantidad_recibida: 10, cantidad_danada: 0, motivo_dano: 'Faltante de origen en despacho proveedor' },
    { id: 5, recepcion_id: 5, id_producto: 76240, cantidad_esperada: 20, cantidad_recibida: 20, cantidad_danada: 0, motivo_dano: null },
    { id: 6, recepcion_id: 6, id_producto: 71043, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 0, motivo_dano: null },
    { id: 7, recepcion_id: 7, id_producto: 10283, cantidad_esperada: 14, cantidad_recibida: 14, cantidad_danada: 1, motivo_dano: 'Empaque exterior con humedad' },
    { id: 8, recepcion_id: 8, id_producto: 71741, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 0, motivo_dano: null },
    { id: 9, recepcion_id: 9, id_producto: 10307, cantidad_esperada: 6, cantidad_recibida: 6, cantidad_danada: 0, motivo_dano: null },
    { id: 10, recepcion_id: 10, id_producto: 21323, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 0, motivo_dano: null },
  ];
  for (const rdet of recepcionesDetalleData) {
    await prisma.log_recepcion_detalle.create({ data: rdet });
  }

  // ==========================================================================
  // 18. TABLAS DE PRUEBA DE MÓDULOS VECINOS (Sección 9.2 - 10 tablas test_log_*)
  // ==========================================================================
  console.log('📌 Insertando datos de prueba en las 10 tablas test_log_*...');

  const testClientes = [
    { id_cliente: 1001, nombre: 'Martín Almeyda', rut: '17.291.844-3', email: 'm.almeyda@cliente.cl' },
    { id_cliente: 1002, nombre: 'Constanza Valenzuela', rut: '18.452.910-1', email: 'c.valenzuela@cliente.cl' },
    { id_cliente: 1003, nombre: 'Felipe Quiroz', rut: '15.632.189-5', email: 'f.quiroz@ucn.cl' },
    { id_cliente: 1004, nombre: 'Bárbara Henríquez', rut: '19.821.432-8', email: 'b.henriquez@cliente.cl' },
    { id_cliente: 1005, nombre: 'Rodrigo Saavedra', rut: '16.112.784-K', email: 'r.saavedra@cliente.cl' },
    { id_cliente: 1006, nombre: 'Camila Montecinos', rut: '18.990.231-7', email: 'c.montecinos@cliente.cl' },
    { id_cliente: 1007, nombre: 'Ignacio Cifuentes', rut: '17.845.620-2', email: 'i.cifuentes@cliente.cl' },
    { id_cliente: 1008, nombre: 'Valentina Soto', rut: '19.412.380-6', email: 'v.soto@cliente.cl' },
    { id_cliente: 1009, nombre: 'Sebastián Lagos', rut: '16.782.901-4', email: 's.lagos@cliente.cl' },
    { id_cliente: 1010, nombre: 'Paulina Morales', rut: '17.654.321-0', email: 'p.morales@cliente.cl' },
    { id_cliente: 1011, nombre: 'Gastón Araya', rut: '14.980.123-9', email: 'g.araya@cliente.cl' },
  ];
  for (const cli of testClientes) {
    await prisma.ventasCliente.create({ data: cli });
  }

  const testProductos = [
    { id_producto: 75192, sku: 'LEGO-SW-75192', nombre: 'LEGO Star Wars Millennium Falcon UCS', peso_unitario_kg: 13.2, largo_cm: 53.0, alto_cm: 46.0, ancho_cm: 38.0 },
    { id_producto: 75252, sku: 'LEGO-SW-75252', nombre: 'LEGO Star Wars Imperial Star Destroyer UCS', peso_unitario_kg: 12.5, largo_cm: 53.0, alto_cm: 46.0, ancho_cm: 38.0 },
    { id_producto: 75288, sku: 'LEGO-SW-75288', nombre: 'LEGO Star Wars AT-AT Walker', peso_unitario_kg: 2.1, largo_cm: 48.0, alto_cm: 37.8, ancho_cm: 9.4 },
    { id_producto: 76240, sku: 'LEGO-DC-76240', nombre: 'LEGO DC Batman Batmobile Tumbler', peso_unitario_kg: 2.8, largo_cm: 45.0, alto_cm: 30.0, ancho_cm: 15.0 },
    { id_producto: 71741, sku: 'LEGO-NJ-71741', nombre: 'LEGO Ninjago City Gardens', peso_unitario_kg: 5.6, largo_cm: 58.2, alto_cm: 48.0, ancho_cm: 17.0 },
    { id_producto: 10294, sku: 'LEGO-IC-10294', nombre: 'LEGO Icons Titanic (9090 piezas)', peso_unitario_kg: 14.5, largo_cm: 60.0, alto_cm: 50.0, ancho_cm: 40.0 },
    { id_producto: 71043, sku: 'LEGO-HP-71043', nombre: 'LEGO Harry Potter Castillo de Hogwarts', peso_unitario_kg: 7.5, largo_cm: 60.0, alto_cm: 51.0, ancho_cm: 20.0 },
    { id_producto: 10283, sku: 'LEGO-IC-10283', nombre: 'LEGO NASA Space Shuttle Discovery', peso_unitario_kg: 3.2, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 11.0 },
    { id_producto: 10295, sku: 'LEGO-IC-10295', nombre: 'LEGO Icons Porsche 911 Turbo & Targa', peso_unitario_kg: 1.8, largo_cm: 48.0, alto_cm: 28.2, ancho_cm: 11.8 },
    { id_producto: 10278, sku: 'LEGO-MD-10278', nombre: 'LEGO Modular Police Station', peso_unitario_kg: 2.9, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 11.0 },
    { id_producto: 10284, sku: 'LEGO-IC-10284', nombre: 'LEGO Icons Camp Nou FC Barcelona', peso_unitario_kg: 5.3, largo_cm: 58.0, alto_cm: 48.0, ancho_cm: 17.0 },
    { id_producto: 10307, sku: 'LEGO-IC-10307', nombre: 'LEGO Icons Torre Eiffel (149 cm)', peso_unitario_kg: 12.0, largo_cm: 62.0, alto_cm: 52.0, ancho_cm: 39.0 },
    { id_producto: 21323, sku: 'LEGO-ID-21323', nombre: 'LEGO Ideas Grand Piano Motorizado', peso_unitario_kg: 5.8, largo_cm: 58.0, alto_cm: 37.0, ancho_cm: 16.0 },
  ];
  for (const prod of testProductos) {
    await prisma.invProducto.create({ data: prod });
  }

  const testPedidos = [
    { id_pedido: 1, id_cliente: 1001, numero: 'PED-10294', estado: 'CONFIRMADO' },
    { id_pedido: 2, id_cliente: 1002, numero: 'PED-10295', estado: 'CONFIRMADO' },
    { id_pedido: 3, id_cliente: 1003, numero: 'PED-10296', estado: 'CONFIRMADO' },
    { id_pedido: 4, id_cliente: 1005, numero: 'PED-10297', estado: 'CONFIRMADO' },
    { id_pedido: 5, id_cliente: 1006, numero: 'PED-10298', estado: 'CONFIRMADO' },
    { id_pedido: 6, id_cliente: 1007, numero: 'PED-10299', estado: 'CONFIRMADO' },
    { id_pedido: 7, id_cliente: 1004, numero: 'PED-10300', estado: 'CONFIRMADO' },
    { id_pedido: 8, id_cliente: 1008, numero: 'PED-10301', estado: 'CONFIRMADO' },
    { id_pedido: 9, id_cliente: 1009, numero: 'PED-10302', estado: 'PENDIENTE_PAGO' },
    { id_pedido: 10, id_cliente: 1010, numero: 'PED-10303', estado: 'CANCELADO' },
    { id_pedido: 11, id_cliente: 1011, numero: 'PED-10304', estado: 'CONFIRMADO' },
    { id_pedido: 12, id_cliente: 1001, numero: 'PED-10305', estado: 'CONFIRMADO' },
  ];
  for (const ped of testPedidos) {
    await prisma.ventasPedido.create({ data: ped });
  }

  const testPedidosDetalle = [
    { id: 1, id_pedido: 1, id_producto: 75192, cantidad: 1 },
    { id: 2, id_pedido: 2, id_producto: 75288, cantidad: 1 },
    { id: 3, id_pedido: 2, id_producto: 76240, cantidad: 1 },
    { id: 4, id_pedido: 3, id_producto: 71741, cantidad: 1 },
    { id: 5, id_pedido: 4, id_producto: 10294, cantidad: 1 },
    { id: 6, id_pedido: 5, id_producto: 71043, cantidad: 1 },
    { id: 7, id_pedido: 6, id_producto: 10283, cantidad: 1 },
    { id: 8, id_pedido: 7, id_producto: 10295, cantidad: 2 },
    { id: 9, id_pedido: 8, id_producto: 10278, cantidad: 1 },
    { id: 10, id_pedido: 8, id_producto: 10284, cantidad: 1 },
    { id: 11, id_pedido: 11, id_producto: 76240, cantidad: 1 },
    { id: 12, id_pedido: 12, id_producto: 75252, cantidad: 1 },
  ];
  for (const pdet of testPedidosDetalle) {
    await prisma.ventasPedidoDetalle.create({ data: pdet });
  }

  const testEmpleados = [
    { id_empleado: 301, nombre: 'Carlos Gómez', cargo: 'Operador de Bodega Central' },
    { id_empleado: 302, nombre: 'Juan Tapia', cargo: 'Operador de Picking Zona Norte' },
    { id_empleado: 303, nombre: 'Loreto Silva', cargo: 'Operadora de Bodega Packing' },
    { id_empleado: 304, nombre: 'Esteban Paredes', cargo: 'Operador de Recepción y Despacho' },
    { id_empleado: 305, nombre: 'Maximiliano Pizarro', cargo: 'Coordinador de Despacho' },
    { id_empleado: 306, nombre: 'Máximo Sazo', cargo: 'Administrador de Logística' },
    { id_empleado: 307, nombre: 'Nicolás Rojas', cargo: 'Coordinador de Transporte' },
    { id_empleado: 308, nombre: 'Daniela Infante', cargo: 'Analista de Control Logístico' },
    { id_empleado: 309, nombre: 'Javier Catalán', cargo: 'Supervisor de Última Milla' },
    { id_empleado: 310, nombre: 'Bastián Salinas', cargo: 'Especialista de Inventario y Cubicación' },
  ];
  for (const emp of testEmpleados) {
    await prisma.rrhhEmpleado.create({ data: emp });
  }

  const testRoles = [
    { id_rol: 1, nombre: 'Administrador' },
    { id_rol: 2, nombre: 'Coordinador de despacho' },
    { id_rol: 3, nombre: 'Operador de bodega' },
    { id_rol: 4, nombre: 'Supervisor de Transporte' },
    { id_rol: 5, nombre: 'Analista de KPIs' },
    { id_rol: 6, nombre: 'Inspector de Recepción' },
    { id_rol: 7, nombre: 'Encargado de Cubicación' },
    { id_rol: 8, nombre: 'Auditor de Inventario' },
    { id_rol: 9, nombre: 'Ejecutivo de Postventa' },
    { id_rol: 10, nombre: 'Consulta General ERP' },
  ];
  for (const rol of testRoles) {
    await prisma.rrhhRol.create({ data: rol });
  }

  const testUsuarios = [
    { id_usuario: 1, id_empleado: 305, id_rol: 2, username: 'mpizarro', password_hash: '$2b$10$hash_coordinador_1', activo: true },
    { id_usuario: 2, id_empleado: 306, id_rol: 1, username: 'msazo', password_hash: '$2b$10$hash_admin_1', activo: true },
    { id_usuario: 3, id_empleado: 301, id_rol: 3, username: 'cgomez', password_hash: '$2b$10$hash_operador_1', activo: true },
    { id_usuario: 4, id_empleado: 302, id_rol: 3, username: 'jtapia', password_hash: '$2b$10$hash_operador_2', activo: true },
    { id_usuario: 5, id_empleado: 303, id_rol: 3, username: 'lsilva', password_hash: '$2b$10$hash_operador_3', activo: true },
    { id_usuario: 6, id_empleado: 304, id_rol: 3, username: 'eparedes', password_hash: '$2b$10$hash_operador_4', activo: true },
    { id_usuario: 7, id_empleado: 307, id_rol: 2, username: 'nrojas', password_hash: '$2b$10$hash_coordinador_2', activo: true },
    { id_usuario: 8, id_empleado: 308, id_rol: 1, username: 'dinfante', password_hash: '$2b$10$hash_admin_2', activo: true },
    { id_usuario: 9, id_empleado: 309, id_rol: 2, username: 'jcatalan', password_hash: '$2b$10$hash_coordinador_3', activo: true },
    { id_usuario: 10, id_empleado: 310, id_rol: 3, username: 'bsalinas', password_hash: '$2b$10$hash_operador_5', activo: true },
  ];
  for (const usr of testUsuarios) {
    await prisma.rrhhUsuario.create({ data: usr });
  }

  const testComprasOc = [
    { id_oc: 8001, proveedor: 'LEGO System A/S (Billund, Dinamarca)', estado: 'EMITIDA' },
    { id_oc: 8002, proveedor: 'LEGO Distribution LATAM (México)', estado: 'EMITIDA' },
    { id_oc: 8003, proveedor: 'LEGO System A/S (Billund, Dinamarca)', estado: 'RECIBIDA' },
    { id_oc: 8004, proveedor: 'Importadora Bricks Chile SpA', estado: 'PARCIAL' },
    { id_oc: 8005, proveedor: 'LEGO System A/S (Billund, Dinamarca)', estado: 'RECIBIDA' },
    { id_oc: 8006, proveedor: 'LEGO Distribution LATAM (México)', estado: 'EMITIDA' },
    { id_oc: 8007, proveedor: 'Importadora Bricks Chile SpA', estado: 'EMITIDA' },
    { id_oc: 8008, proveedor: 'LEGO System A/S (Billund, Dinamarca)', estado: 'RECIBIDA' },
    { id_oc: 8009, proveedor: 'LEGO Distribution LATAM (México)', estado: 'EMITIDA' },
    { id_oc: 8010, proveedor: 'Distribuidora Oficial Juguetes Sur Ltda.', estado: 'RECIBIDA' },
  ];
  for (const oc of testComprasOc) {
    await prisma.comprasOc.create({ data: oc });
  }

  const testComprasOcDetalle = [
    { id: 1, id_oc: 8001, id_producto: 75192, cantidad_esperada: 10 },
    { id: 2, id_oc: 8002, id_producto: 75288, cantidad_esperada: 15 },
    { id: 3, id_oc: 8003, id_producto: 10294, cantidad_esperada: 8 },
    { id: 4, id_oc: 8004, id_producto: 10284, cantidad_esperada: 12 },
    { id: 5, id_oc: 8005, id_producto: 76240, cantidad_esperada: 20 },
    { id: 6, id_oc: 8006, id_producto: 71043, cantidad_esperada: 10 },
    { id: 7, id_oc: 8007, id_producto: 10283, cantidad_esperada: 14 },
    { id: 8, id_oc: 8008, id_producto: 71741, cantidad_esperada: 10 },
    { id: 9, id_oc: 8009, id_producto: 10307, cantidad_esperada: 6 },
    { id: 10, id_oc: 8010, id_producto: 21323, cantidad_esperada: 10 },
  ];
  for (const ocd of testComprasOcDetalle) {
    await prisma.comprasOcDetalle.create({ data: ocd });
  }

  // Sincronizar secuencias autoincrementales en el esquema logistica tras inserción de IDs explícitos
  const tablasConSecuencia: Array<{ tabla: string; col: string }> = [
    { tabla: 'log_region', col: 'id' },
    { tabla: 'log_comuna', col: 'id' },
    { tabla: 'log_transportista', col: 'id' },
    { tabla: 'log_servicio', col: 'id' },
    { tabla: 'log_cobertura', col: 'id' },
    { tabla: 'log_tarifa', col: 'id' },
    { tabla: 'log_direccion', col: 'id' },
    { tabla: 'log_ot_picking_detalle', col: 'id' },
    { tabla: 'log_bulto', col: 'id' },
    { tabla: 'log_evento_tracking', col: 'id' },
    { tabla: 'log_estado_envio', col: 'id' },
    { tabla: 'log_bulto_detalle', col: 'id' },
    { tabla: 'log_incidencia', col: 'id' },
    { tabla: 'log_recepcion', col: 'id' },
    { tabla: 'log_recepcion_detalle', col: 'id' },
    { tabla: 'test_log_ventas_cliente', col: 'id_cliente' },
    { tabla: 'test_log_ventas_pedido', col: 'id_pedido' },
    { tabla: 'test_log_ventas_pedido_detalle', col: 'id' },
    { tabla: 'test_log_inv_mov', col: 'id_mov' },
    { tabla: 'test_log_rrhh_empleado', col: 'id_empleado' },
    { tabla: 'test_log_rrhh_rol', col: 'id_rol' },
    { tabla: 'test_log_rrhh_usuario', col: 'id_usuario' },
    { tabla: 'test_log_compras_oc', col: 'id_oc' },
    { tabla: 'test_log_compras_oc_detalle', col: 'id' },
  ];

  for (const item of tablasConSecuencia) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('logistica.${item.tabla}', '${item.col}'), COALESCE((SELECT MAX(${item.col}) FROM logistica.${item.tabla}), 1), true);`
    );
  }

  console.log('✅ Seed completado exitosamente en esquema "logistica" (27 tablas pobladas: 17 log_* y 10 test_log_* con >= 10 registros c/u).');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Error durante seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
