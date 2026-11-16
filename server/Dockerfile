# ==============================================================================
# Dockerfile para el Backend de Logística y Transporte (LesGo ERP)
# ==============================================================================
# Etapa 1: Compilación de TypeScript y generación de Prisma
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar OpenSSL requerido por el motor de Prisma en Alpine Linux
RUN apk add --no-cache openssl

# Copiar manifiestos de dependencias
COPY package*.json ./
COPY server/package*.json ./server/
COPY prisma ./prisma

# Instalar todas las dependencias (raíz y server)
RUN npm install
RUN npm --prefix server install

# Generar cliente de Prisma para el esquema de logistica
RUN npx prisma generate

# Copiar código fuente y configuración de TypeScript
COPY server/src ./server/src
COPY server/tsconfig.json ./server/tsconfig.json

# Compilar TypeScript a JavaScript en server/dist
RUN npm --prefix server run build

# ==============================================================================
# Etapa 2: Imagen final de ejecución (Ligera y segura)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar OpenSSL en tiempo de ejecución para Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3001

# Copiar dependencias y artefactos compilados desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server/dist ./server/dist

# Puerto donde escucha la API REST de Logística
EXPOSE 3001

# Ejecutar el servidor compilado
CMD ["node", "server/dist/index.js"]
