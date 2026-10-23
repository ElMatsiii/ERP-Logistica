import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createLogisticaRouter } from './routes/logistica.routes.js';
import { checkDatabaseConnection } from './lib/prisma.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

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
  const dbOk = await checkDatabaseConnection();
  res.json({
    status: 'ok',
    module: 'LesGo ERP - Módulo Logística y Transporte',
    schema: 'logistica',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'conectado (Neon PostgreSQL - esquema logistica)' : 'sin_conexion_pg',
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
  console.log(`🚀 Servidor LesGo ERP (Logística) activo en: http://localhost:${PORT}`);
  console.log(`📦 Origen permitido CORS: ${CLIENT_URL}`);
  console.log('======================================================');
  
  const dbOk = await checkDatabaseConnection();
  if (dbOk) {
    console.log('✅ Conexión con PostgreSQL (Neon - esquema "logistica") verificada exitosamente.');
  } else {
    console.warn('⚠️ Base de datos PostgreSQL no detectada en DATABASE_URL.');
    console.warn('👉 Verifica la variable DATABASE_URL en el archivo .env');
    console.warn('👉 Para migrar y poblar: npm run db:setup');
  }
});
