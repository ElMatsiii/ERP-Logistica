/**
 * Conjunto de datos de inicialización sincronizado con prisma/seed.ts
 * Utilizado por el repositorio como respaldo transaccional en caso de que
 * PostgreSQL no se encuentre levantado en el entorno local de evaluación.
 */

export const mockRegiones = [
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

export const mockComunas = [
  { id: 101, region_id: 5, nombre: 'La Serena', region: mockRegiones[4] },
  { id: 102, region_id: 5, nombre: 'Coquimbo', region: mockRegiones[4] },
  { id: 103, region_id: 5, nombre: 'Vicuña', region: mockRegiones[4] },
  { id: 104, region_id: 5, nombre: 'Ovalle', region: mockRegiones[4] },
  { id: 105, region_id: 5, nombre: 'Andacollo', region: mockRegiones[4] },
  { id: 106, region_id: 5, nombre: 'Paihuano', region: mockRegiones[4] },
  { id: 201, region_id: 7, nombre: 'Santiago Centro', region: mockRegiones[6] },
  { id: 202, region_id: 7, nombre: 'Las Condes', region: mockRegiones[6] },
  { id: 203, region_id: 7, nombre: 'Maipú', region: mockRegiones[6] },
  { id: 204, region_id: 7, nombre: 'Providencia', region: mockRegiones[6] },
  { id: 205, region_id: 7, nombre: 'Puente Alto', region: mockRegiones[6] },
  { id: 206, region_id: 7, nombre: 'Vitacura', region: mockRegiones[6] },
];

export const mockTransportistas = [
  {
    id: 1,
    rut: '96.554.000-4',
    nombre: 'Chilexpress',
    contacto_email: 'integraciones@chilexpress.cl',
    contacto_telefono: '+56 2 2361 2000',
    factor_volumetrico_default: 5000,
    activo: true,
    servicios: [
      { id: 1, transportista_id: 1, nombre: 'Chilexpress Prioritario (24h)', dias_transito_comprometidos: 1, activo: true },
      { id: 2, transportista_id: 1, nombre: 'Chilexpress Día Hábil Siguiente', dias_transito_comprometidos: 1, activo: true },
      { id: 3, transportista_id: 1, nombre: 'Chilexpress Extendido Terrestre', dias_transito_comprometidos: 3, activo: true },
    ],
  },
  {
    id: 2,
    rut: '96.882.110-K',
    nombre: 'Starken',
    contacto_email: 'empresas@starken.cl',
    contacto_telefono: '+56 2 2762 1000',
    factor_volumetrico_default: 4000,
    activo: true,
    servicios: [
      { id: 4, transportista_id: 2, nombre: 'Starken Normal a Domicilio', dias_transito_comprometidos: 2, activo: true },
      { id: 5, transportista_id: 2, nombre: 'Starken Express AM', dias_transito_comprometidos: 1, activo: true },
      { id: 6, transportista_id: 2, nombre: 'Starken Carga Especial Bulto Pesado', dias_transito_comprometidos: 3, activo: true },
    ],
  },
  {
    id: 3,
    rut: '76.123.456-7',
    nombre: 'Blue Express',
    contacto_email: 'contacto@bluex.cl',
    contacto_telefono: '+56 2 2450 8000',
    factor_volumetrico_default: 5000,
    activo: true,
    servicios: [
      { id: 7, transportista_id: 3, nombre: 'Blue Express Prioritario', dias_transito_comprometidos: 1, activo: true },
      { id: 8, transportista_id: 3, nombre: 'Blue Express Estándar Nacional', dias_transito_comprometidos: 2, activo: true },
      { id: 9, transportista_id: 3, nombre: 'Blue Express Same-Day Express', dias_transito_comprometidos: 0, activo: true },
    ],
  },
  {
    id: 4,
    rut: '70.012.300-9',
    nombre: 'Correos de Chile',
    contacto_email: 'atencion@correos.cl',
    contacto_telefono: '+56 2 2956 0000',
    factor_volumetrico_default: 5000,
    activo: true,
    servicios: [
      { id: 10, transportista_id: 4, nombre: 'Correos Chile Paquete Domicilio', dias_transito_comprometidos: 3, activo: true },
    ],
  },
];

export const mockServicios = mockTransportistas.flatMap((t) =>
  t.servicios.map((s) => ({ ...s, transportista: t }))
);

export const mockCoberturas = [
  { id: 1, servicio_id: 1, comuna_id: 101, vigente: true }, // La Serena
  { id: 2, servicio_id: 1, comuna_id: 102, vigente: true }, // Coquimbo
  { id: 3, servicio_id: 1, comuna_id: 103, vigente: true }, // Vicuña
  { id: 4, servicio_id: 1, comuna_id: 201, vigente: true }, // Santiago
  { id: 5, servicio_id: 1, comuna_id: 202, vigente: true }, // Las Condes
  { id: 6, servicio_id: 1, comuna_id: 203, vigente: true }, // Maipú
  { id: 7, servicio_id: 4, comuna_id: 101, vigente: true }, // Starken La Serena
  { id: 8, servicio_id: 4, comuna_id: 104, vigente: true }, // Starken Ovalle
  { id: 9, servicio_id: 4, comuna_id: 201, vigente: true }, // Starken Santiago
  { id: 10, servicio_id: 7, comuna_id: 101, vigente: true }, // Bluex La Serena
  { id: 11, servicio_id: 7, comuna_id: 201, vigente: true }, // Bluex Santiago
  // Cobertura NO vigente para pruebas
  { id: 13, servicio_id: 1, comuna_id: 105, vigente: false }, // Andacollo
];

export const mockTarifas = [
  { id: 1, servicio_id: 1, comuna_id: 101, peso_desde_kg: 0, peso_hasta_kg: 3, precio_base: 4500, precio_kg_adicional: 1200 },
  { id: 2, servicio_id: 1, comuna_id: 102, peso_desde_kg: 0, peso_hasta_kg: 3, precio_base: 4700, precio_kg_adicional: 1200 },
  { id: 4, servicio_id: 1, comuna_id: 201, peso_desde_kg: 0, peso_hasta_kg: 3, precio_base: 3900, precio_kg_adicional: 900 },
  { id: 5, servicio_id: 1, comuna_id: 202, peso_desde_kg: 0, peso_hasta_kg: 3, precio_base: 4200, precio_kg_adicional: 950 },
  { id: 6, servicio_id: 1, comuna_id: 203, peso_desde_kg: 0, peso_hasta_kg: 3, precio_base: 4100, precio_kg_adicional: 950 },
];

export const mockDirecciones = [
  { id: 1, cliente_id: 1001, cliente_nombre: 'Martín Almeyda', cliente_rut: '17.291.844-3', comuna_id: 101, calle: 'Av. Cuatro Esquinas', numero: '1420', depto: 'Torre B, Depto 402', comuna: mockComunas[0] },
  { id: 2, cliente_id: 1002, cliente_nombre: 'Constanza Valenzuela', cliente_rut: '18.452.910-1', comuna_id: 102, calle: 'Calle Baquedano', numero: '550', depto: null, comuna: mockComunas[1] },
  { id: 3, cliente_id: 1003, cliente_nombre: 'Felipe Quiroz', cliente_rut: '15.632.189-5', comuna_id: 103, calle: 'Gabriela Mistral', numero: '280', depto: 'Casa 3', comuna: mockComunas[2] },
  { id: 4, cliente_id: 1004, cliente_nombre: 'Bárbara Henríquez', cliente_rut: '19.821.432-8', comuna_id: 104, calle: 'Ariztía Poniente', numero: '915', depto: null, comuna: mockComunas[3] },
  { id: 5, cliente_id: 1005, cliente_nombre: 'Rodrigo Saavedra', cliente_rut: '16.112.784-K', comuna_id: 201, calle: 'Moneda', numero: '1040', depto: 'Oficina 601', comuna: mockComunas[6] },
  { id: 6, cliente_id: 1006, cliente_nombre: 'Camila Montecinos', cliente_rut: '18.990.231-7', comuna_id: 202, calle: 'Av. Apoquindo', numero: '4800', depto: 'Depto 1204', comuna: mockComunas[7] },
  { id: 7, cliente_id: 1007, cliente_nombre: 'Ignacio Cifuentes', cliente_rut: '17.845.620-2', comuna_id: 203, calle: 'Av. Pajaritos', numero: '3100', depto: 'Block 4, Depto 21', comuna: mockComunas[8] },
  { id: 11, cliente_id: 1011, cliente_nombre: 'Gastón Araya (Comuna Sin Cobertura)', cliente_rut: '14.980.123-9', comuna_id: 105, calle: 'Calle Urmeneta', numero: '120', depto: null, comuna: mockComunas[4] },
];

export const mockOts: any[] = [
  {
    id: 'OT-4091',
    id_pedido: 'PED-10294',
    id_operador: 301,
    nombre_operador: 'Carlos Gómez (Bodega Central)',
    estado: 'CERRADO',
    cliente_id: 1001,
    cliente_nombre: 'Martín Almeyda',
    cliente_rut: '17.291.844-3',
    direccion_id: 1,
    direccion: mockDirecciones[0],
    fecha_creacion: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    detalles: [
      { id: 1, ot_id: 'OT-4091', id_producto: 75192, sku: 'LEGO-SW-75192', nombre_producto: 'LEGO Star Wars Millennium Falcon UCS', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 13.2, largo_cm: 53, alto_cm: 46, ancho_cm: 38 },
    ],
  },
  {
    id: 'OT-4092',
    id_pedido: 'PED-10295',
    id_operador: 302,
    nombre_operador: 'Juan Tapia (Picking Zona Norte)',
    estado: 'CERRADO',
    cliente_id: 1002,
    cliente_nombre: 'Constanza Valenzuela',
    cliente_rut: '18.452.910-1',
    direccion_id: 2,
    direccion: mockDirecciones[1],
    fecha_creacion: new Date(Date.now() - 3600000 * 24 * 2.5).toISOString(),
    detalles: [
      { id: 2, ot_id: 'OT-4092', id_producto: 75288, sku: 'LEGO-SW-75288', nombre_producto: 'LEGO Star Wars AT-AT Walker', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.1, largo_cm: 48, alto_cm: 37.8, ancho_cm: 9.4 },
      { id: 3, ot_id: 'OT-4092', id_producto: 76240, sku: 'LEGO-DC-76240', nombre_producto: 'LEGO DC Batman Batmobile Tumbler', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.8, largo_cm: 45, alto_cm: 30, ancho_cm: 15 },
    ],
  },
  {
    id: 'OT-4093',
    id_pedido: 'PED-10296',
    id_operador: 301,
    nombre_operador: 'Carlos Gómez (Bodega Central)',
    estado: 'CERRADO',
    cliente_id: 1003,
    cliente_nombre: 'Felipe Quiroz',
    cliente_rut: '15.632.189-5',
    direccion_id: 3,
    direccion: mockDirecciones[2],
    fecha_creacion: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    detalles: [
      { id: 4, ot_id: 'OT-4093', id_producto: 71741, sku: 'LEGO-NJ-71741', nombre_producto: 'LEGO Ninjago City Gardens', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 5.6, largo_cm: 58.2, alto_cm: 48, ancho_cm: 17 },
    ],
  },
  {
    id: 'OT-4094',
    id_pedido: 'PED-10297',
    id_operador: 303,
    nombre_operador: 'Loreto Silva (Bodega Packing)',
    estado: 'CERRADO',
    cliente_id: 1005,
    cliente_nombre: 'Rodrigo Saavedra',
    cliente_rut: '16.112.784-K',
    direccion_id: 5,
    direccion: mockDirecciones[4],
    fecha_creacion: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(),
    detalles: [
      { id: 5, ot_id: 'OT-4094', id_producto: 10294, sku: 'LEGO-IC-10294', nombre_producto: 'LEGO Icons Titanic (9090 piezas)', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 14.5, largo_cm: 60, alto_cm: 50, ancho_cm: 40 },
    ],
  },
  {
    id: 'OT-4097',
    id_pedido: 'PED-10300',
    id_operador: 301,
    nombre_operador: 'Carlos Gómez (Bodega Central)',
    estado: 'PENDIENTE',
    cliente_id: 1004,
    cliente_nombre: 'Bárbara Henríquez',
    cliente_rut: '19.821.432-8',
    direccion_id: 4,
    direccion: mockDirecciones[3],
    fecha_creacion: new Date(Date.now() - 3600000 * 12).toISOString(),
    detalles: [
      { id: 8, ot_id: 'OT-4097', id_producto: 10295, sku: 'LEGO-IC-10295', nombre_producto: 'LEGO Icons Porsche 911 Turbo & Targa', cant_solicitada: 2, cant_recolectada: 0, peso_unitario_kg: 1.8, largo_cm: 48, alto_cm: 28.2, ancho_cm: 11.8 },
    ],
  },
  {
    id: 'OT-4098',
    id_pedido: 'PED-10301',
    id_operador: 302,
    nombre_operador: 'Juan Tapia (Picking Zona Norte)',
    estado: 'PARCIAL',
    cliente_id: 1006,
    cliente_nombre: 'Camila Montecinos',
    cliente_rut: '18.990.231-7',
    direccion_id: 6,
    direccion: mockDirecciones[5],
    fecha_creacion: new Date(Date.now() - 3600000 * 8).toISOString(),
    detalles: [
      { id: 9, ot_id: 'OT-4098', id_producto: 10278, sku: 'LEGO-MD-10278', nombre_producto: 'LEGO Modular Police Station', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.9, largo_cm: 58, alto_cm: 37, ancho_cm: 11 },
    ],
  },
  {
    id: 'OT-4101',
    id_pedido: 'PED-10304',
    id_operador: 301,
    nombre_operador: 'Carlos Gómez (Bodega Central)',
    estado: 'CERRADO',
    cliente_id: 1011,
    cliente_nombre: 'Gastón Araya (Comuna Sin Cobertura)',
    cliente_rut: '14.980.123-9',
    direccion_id: 11,
    direccion: mockDirecciones[7],
    fecha_creacion: new Date(Date.now() - 3600000 * 6).toISOString(),
    detalles: [
      { id: 13, ot_id: 'OT-4101', id_producto: 76240, sku: 'LEGO-DC-76240', nombre_producto: 'LEGO DC Batman Batmobile Tumbler', cant_solicitada: 1, cant_recolectada: 1, peso_unitario_kg: 2.8, largo_cm: 45, alto_cm: 30, ancho_cm: 15 },
    ],
  },
];

export const mockGuias: any[] = [
  {
    id: 'GD-52301',
    ot_id: 'OT-4091',
    transportista_id: 1,
    servicio_id: 1,
    direccion_id: 1,
    num_seguimiento: 'CHX-774091-CL',
    factor_volumetrico_aplicado: 5000,
    peso_real_total_kg: 13.2,
    peso_volumetrico_total_kg: 18.53,
    costo_envio: 22400,
    estado_actual: 'Entregado conforme',
    fecha_emision: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    ot: mockOts[0],
    transportista: mockTransportistas[0],
    servicio: mockTransportistas[0].servicios[0],
    direccion: mockDirecciones[0],
    bultos: [{ id: 1, largo_cm: 53, alto_cm: 46, ancho_cm: 38, peso_real_kg: 13.2, peso_volumetrico_kg: 18.53 }],
    eventos: [
      { id: 1, guia_id: 'GD-52301', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 4).toISOString(), usuario_responsable: 'M. Pizarro', observacion: 'Bulto embalado con sello de seguridad LEGO' },
      { id: 2, guia_id: 'GD-52301', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.8).toISOString(), usuario_responsable: 'C. Gómez', observacion: 'Entregado a móvil Chilexpress ruta Norte' },
      { id: 3, guia_id: 'GD-52301', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.2).toISOString(), usuario_responsable: 'Chilexpress HUB', observacion: 'Arribo a centro de distribución La Serena' },
      { id: 4, guia_id: 'GD-52301', estado: 'Entregado conforme', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.8).toISOString(), usuario_responsable: 'Conductor Chilexpress', observacion: 'Recibido por conserjería edificio, firma conforme' },
    ],
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
    fecha_emision: new Date(Date.now() - 3600000 * 24 * 3.5).toISOString(),
    ot: mockOts[1],
    transportista: mockTransportistas[0],
    servicio: mockTransportistas[0].servicios[1],
    direccion: mockDirecciones[1],
    bultos: [{ id: 2, largo_cm: 48, alto_cm: 37.8, ancho_cm: 18, peso_real_kg: 4.9, peso_volumetrico_kg: 7.45 }],
    eventos: [
      { id: 5, guia_id: 'GD-52302', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.5).toISOString(), usuario_responsable: 'M. Pizarro', observacion: 'Emisión de guía y verificación de contenido' },
      { id: 6, guia_id: 'GD-52302', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 3.1).toISOString(), usuario_responsable: 'J. Tapia', observacion: 'Carga retirada por móvil' },
      { id: 7, guia_id: 'GD-52302', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.5).toISOString(), usuario_responsable: 'Chilexpress HUB', observacion: 'En reparto hacia domicilio en Coquimbo' },
      { id: 8, guia_id: 'GD-52302', estado: 'Entrega Fallida', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.1).toISOString(), usuario_responsable: 'Conductor Chilexpress', observacion: 'Primer intento fallido: Domicilio cerrado sin moradores' },
    ],
  },
  {
    id: 'GD-52303',
    ot_id: 'OT-4093',
    transportista_id: 2,
    servicio_id: 4,
    direccion_id: 3,
    num_seguimiento: 'STK-884093-CL',
    factor_volumetrico_aplicado: 4000,
    peso_real_total_kg: 5.6,
    peso_volumetrico_total_kg: 11.87,
    costo_envio: 14500,
    estado_actual: 'En tránsito',
    fecha_emision: new Date(Date.now() - 3600000 * 24 * 2.8).toISOString(),
    ot: mockOts[2],
    transportista: mockTransportistas[1],
    servicio: mockTransportistas[1].servicios[0],
    direccion: mockDirecciones[2],
    bultos: [{ id: 3, largo_cm: 58.2, alto_cm: 48, ancho_cm: 17, peso_real_kg: 5.6, peso_volumetrico_kg: 11.87 }],
    eventos: [
      { id: 9, guia_id: 'GD-52303', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.8).toISOString(), usuario_responsable: 'M. Pizarro', observacion: 'Bulto con protección de esquinas rígidas' },
      { id: 10, guia_id: 'GD-52303', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2.2).toISOString(), usuario_responsable: 'L. Silva', observacion: 'Entregado a transporte Starken' },
      { id: 11, guia_id: 'GD-52303', estado: 'En tránsito', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.2).toISOString(), usuario_responsable: 'Starken HUB Ovalle', observacion: 'En transferencia hacia sucursal Vicuña' },
    ],
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
    fecha_emision: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    ot: mockOts[3],
    transportista: mockTransportistas[0],
    servicio: mockTransportistas[0].servicios[0],
    direccion: mockDirecciones[4],
    bultos: [{ id: 4, largo_cm: 60, alto_cm: 50, ancho_cm: 40, peso_real_kg: 14.5, peso_volumetrico_kg: 24.0 }],
    eventos: [
      { id: 12, guia_id: 'GD-52304', estado: 'Preparado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), usuario_responsable: 'M. Pizarro', observacion: 'Caja doble corrugado para Set Titanic' },
      { id: 13, guia_id: 'GD-52304', estado: 'Despachado', fecha_hora: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(), usuario_responsable: 'C. Gómez', observacion: 'Retirado por Chilexpress en bodega central' },
    ],
  },
];

export const mockInvMov: any[] = [
  { id: 1, id_producto: 75192, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52301 / OT-4091', fecha: new Date().toISOString() },
  { id: 2, id_producto: 75288, tipo: 'SALIDA', cantidad: 1, referencia_origen: 'GD-52302 / OT-4092', fecha: new Date().toISOString() },
];
