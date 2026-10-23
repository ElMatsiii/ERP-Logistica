import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const ddlPath = path.resolve(process.cwd(), 'db/ddl/001_log_tablas.sql');
  console.log(`📄 Ejecutando DDL seguro e idempotente desde: ${ddlPath}`);

  const sql = fs.readFileSync(ddlPath, 'utf-8');

  // Separar bloques DO $$ ... $$; y sentencias CREATE ...;
  const statements: string[] = [];
  const regex = /(DO\s+\$\$[\s\S]*?\$\$;|CREATE\s+[\s\S]*?;)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    statements.push(match[1].trim());
  }

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  console.log(`✅ DDL ejecutado exitosamente (${statements.length} sentencias en esquema "logistica").`);
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar DDL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
