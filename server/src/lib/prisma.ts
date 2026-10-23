import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde la raíz del monorepo o directorio actual
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'logistica'`;
    return true;
  } catch (error) {
    console.warn('[WARN] No se pudo establecer conexión con PostgreSQL (esquema logistica):', (error as Error).message);
    return false;
  }
}
