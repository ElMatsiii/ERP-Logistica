import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createLogisticaRouter } from './routes/logistica.routes.js';
import { checkDatabaseConnection } from './lib/prisma.js';
import { obtenerClienteInventario } from './integrations/inventario/index.js';
import { obtenerClienteRrhh, verificarRrhhConLimite } from './integrations/rrhh/index.js';
import { ConfigAuthError, leerConfigAuth, type ConfigAuth } from './config/auth.config.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// Configuración de autenticación: si es inválida (p. ej. AUTH_MODO=jwt sin JWT_SECRET), no se arranca
let configAuth: ConfigAuth;
try {
  configAuth = leerConfigAuth();
} catch (error) {
  if (error instanceof ConfigAuthError) {
    console.error(`[ERROR] Configuración de autenticación inválida: ${error.message}`);
    console.error('[ERROR] El servidor no se inicia. Revisa AUTH_MODO, JWT_SECRET y JWT_EXPIRES_IN en .env');
    process.exit(1);
  }
  throw error;
}

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware de CORS
app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

app.use(express.json());

// Logger de peticiones en consola
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Ruta de comprobación de salud
app.get('/api/health', async (req, res) => {
  // RRHH nunca hace fallar ni colgar el health: verificarRrhhConLimite no lanza y corta a los 3 s
  const [dbOk, rrhh] = await Promise.all([
    checkDatabaseConnection(),
    verificarRrhhConLimite(obtenerClienteRrhh()),
  ]);
  res.json({
    status: 'ok',
    module: 'LesGo ERP - Módulo Logística y Transporte',
    schema: 'logistica',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'conectado (Neon PostgreSQL - esquema logistica)' : 'sin_conexion_pg',
    rrhh,
  });
});

// Montaje de rutas de logística
app.use('/api/logistica', createLogisticaRouter());

// Manejador 404
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log('======================================================');
  console.log(`[INFO] Servidor LesGo ERP (Logística) activo en: http://localhost:${PORT}`);
  console.log(`[INFO] Origen permitido CORS: ${CLIENT_URL}`);
  console.log(`[INFO] Autenticación: AUTH_MODO=${configAuth.modo} (token válido por ${configAuth.jwtExpiresInSeg / 3600} h)`);
  for (const advertencia of configAuth.advertencias) console.warn(`[WARN] ${advertencia}`);
  console.log('======================================================');
  
  const dbOk = await checkDatabaseConnection();
  if (dbOk) {
    console.log('[OK] Conexión con PostgreSQL (Neon - esquema "logistica") verificada exitosamente.');
  } else {
    console.warn('[WARN] Base de datos PostgreSQL no detectada en DATABASE_URL.');
    console.warn('[INFO] Verifica la variable DATABASE_URL en el archivo .env');
    console.warn('[INFO] Para migrar y poblar: npm run db:setup');
  }

  // Muestra si se usará Inventario real o simulado (según INVENTARIO_API_URL)
  obtenerClienteInventario();

  // Muestra si RRHH se lee de la BD (esquema rrhh) o se simula (según RRHH_MODO)
  const rrhh = await verificarRrhhConLimite(obtenerClienteRrhh());
  if (rrhh.ok) {
    console.log(`[OK] RRHH disponible (modo ${rrhh.modo}).`);
  } else {
    console.warn(`[WARN] RRHH no disponible (modo ${rrhh.modo}): ${rrhh.error}`);
  }
});
