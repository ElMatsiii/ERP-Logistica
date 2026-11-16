import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Ejecuta en orden todos los scripts de db/ddl (001, 002, ...).
async function main() {
  const ddlDir = path.resolve(process.cwd(), 'db/ddl');
  const archivos = fs
    .readdirSync(ddlDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    await ejecutarArchivo(path.join(ddlDir, archivo));
  }
}

async function ejecutarArchivo(ddlPath: string) {
  console.log(`[INFO] Ejecutando DDL seguro e idempotente desde: ${ddlPath}`);

  const rawSql = fs.readFileSync(ddlPath, 'utf-8');
  // Eliminar comentarios de línea
  const sqlSinComentarios = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  // Extraer bloques DO $$ ... $$; y sentencias terminadas en ;
  const statements: string[] = ['CREATE SCHEMA IF NOT EXISTS logistica;'];
  const doBlockRegex = /DO\s+\$\$[\s\S]*?\$\$\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = doBlockRegex.exec(sqlSinComentarios)) !== null) {
    statements.push(match[0].trim());
  }

  const restoSql = sqlSinComentarios
    .replace(doBlockRegex, '')
    .replace(/CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+logistica\s*;/gi, '');
  for (const part of restoSql.split(';')) {
    const stmt = part.trim();
    if (stmt.length > 0) {
      statements.push(`${stmt};`);
    }
  }

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  console.log(`[OK] DDL ejecutado exitosamente (${statements.length} sentencias en esquema "logistica").`);
}

main()
  .catch((e) => {
    console.error('[ERROR] Error al ejecutar DDL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
