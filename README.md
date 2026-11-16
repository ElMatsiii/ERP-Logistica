# LesGo ERP — Módulo de Logística y Transporte
**Sprint 2: Desarrollo Inicial MVP**  
*Asignatura: Sistemas de Información II — Universidad Católica del Norte (UCN)*  
*Grupo 6: Maximiliano Pizarro, Máximo Sazo, Nicolás Rojas, Daniela Infante, Javier Catalán, Bastián Salinas.*

---

## Resumen del Proyecto

Este módulo implementa la solución integral de **Logística y Transporte** para el ERP de **"LesGo"** (tienda especializada en sets emblemáticos de LEGO). Cubre el ciclo completo desde la validación de órdenes de trabajo recolectadas (*picking*), cubicación volumétrica en tiempo real, selección de transportistas y emisión de Guías de Despacho con confirmación del egreso de stock en la API de Inventario, hasta la consola de seguimiento y bitácora cronológica (*tracking*).

---

## Stack Tecnológico y Arquitectura

- **Frontend (`client/`)**:
  - React 18 + TypeScript + Vite + Tailwind CSS.
  - Identidad corporativa LEGO: Navbar rojo (`#e52521`), almenas blancas inferiores estilo bloques LEGO, tipografía LesGo y perfil del operador *"M. Pizarro (Coordinador de Despacho)"*.
  - Cubicación interactiva con cálculo en tiempo real de peso volumétrico y facturable.
- **Backend (`server/`)**:
  - Node.js + Express + TypeScript.
  - Arquitectura Limpia por capas:
    - `src/domain/cubicacion.ts`: Lógica pura de dominio y reglas matemáticas desacopladas.
    - `src/repositories/logistica.repository.ts`: Capa de persistencia y transacciones atómicas.
    - `src/services/logistica.service.ts`: Orquestación y reglas de negocio.
    - `src/controllers/logistica.controller.ts`: Controladores HTTP REST.
    - `src/routes/logistica.routes.ts`: Ruteo `/api/logistica/*`.
- **Persistencia**:
  - PostgreSQL 16 + Prisma ORM.
  - Esquema modelado con prefijo `log_*` (17 entidades) y tablas `test_log_*` (10 entidades).
  - Script de Seed `prisma/seed.ts` con más de 10 registros reales por tabla.

---

## Modelo de Datos

1. `log_transportista`: Chilexpress, Starken, Blue Express, Correos Chile, etc.
2. `log_servicio`: Servicios prioritarios, día siguiente, estándar terrestre.
3. `log_region`: Regiones de Chile (Coquimbo, RM, Biobío, etc.).
4. `log_comuna`: Comunas con y sin cobertura (La Serena, Coquimbo, Santiago, etc.).
5. `log_cobertura`: Vigencia temporal de cobertura por servicio y comuna.
6. `log_tarifa`: Tramos de peso base y costo adicional por kg.
7. `log_direccion`: Domicilios de clientes vinculados a comunas.
8. `log_ot_picking`: Órdenes con estados (`CERRADO`, `PENDIENTE`, `PARCIAL`, `EN_PROCESO`).
9. `log_ot_picking_detalle`: Sets LEGO (Millennium Falcon, AT-AT, Titanic, etc.).
10. `log_guia_despacho`: Guías emitidas con número de seguimiento y costo.
11. `log_bulto`: Medidas de embalaje (largo, alto, ancho, pesos).
12. `log_evento_tracking`: Bitácora *append-only* de cambios de estado.
13. `test_log_inv_mov` (`inv_mov`): Movimientos de inventario de prueba (el despacho ya no escribe aquí: lo confirma la API de Inventario).

---

## Reglas de Negocio Implementadas

1. **Validación de Estado OT**:
   - Solo se emite guía si la OT está en `CERRADO` (todo recolectado) o `PARCIAL` (se despacha lo recolectado e Inventario libera el resto). En otro estado, el frontend bloquea la acción y el backend responde `HTTP 422`.
   - **Un pedido, una guía**: si la OT ya tiene una guía, se responde `HTTP 409`. Si esa guía espera a Inventario, se reintenta esa misma guía.
2. **Validación de Cobertura Vigente**:
   - Se valida que la comuna de destino del cliente posea cobertura activa (`vigente = true`) para el transportista y servicio seleccionado. En caso contrario, se responde `HTTP 422`.
3. **Validación de Dimensiones y Pesos**:
   - El peso real y las tres dimensiones del bulto deben ser estrictamente mayores a cero (`HTTP 400`).
4. **Cálculo de Cubicación Volumétrica**:
   - Peso Volumétrico = $\frac{\text{Largo} \times \text{Alto} \times \text{Ancho}}{\text{Factor Volumétrico}}$ (default 5000 o según transportista).
   - Peso a Cobrar = $\max(\text{Peso Real}, \text{Peso Volumétrico})$.
5. **Transaccionalidad y Confirmación de Stock con Inventario**:
   - Antes de crear la guía se consulta la reserva del pedido en Inventario (`GET /reservas`): sin reserva responde `HTTP 422`, si no está `PENDIENTE` responde `HTTP 409` y si Inventario no responde, `HTTP 503`. En esos casos no se crea nada.
   - En una única transacción Prisma `$transaction` se crean la guía (en `Pendiente de stock`), los bultos y el evento inicial en bitácora.
   - Luego se pide a Inventario el egreso (`POST /movimientos/despacho`) con **todas** las líneas de la OT y lo recolectado tal cual (0 si no se encontró). Si confirma, la guía pasa a `Preparado`; si falla, queda en `Error de stock` y se reintenta con `POST /api/logistica/guias/:id/reintentar-stock` (Inventario no descuenta dos veces la misma guía).
   - Mientras la guía está en `Pendiente de stock` o `Error de stock` no se registran eventos de transporte.

---

## Puesta en Marcha

### 1. Configuración de Conexión a Base de Datos (Neon PostgreSQL)
El proyecto se conecta al servidor compartido de la asignatura en Neon PostgreSQL, aislando todas sus tablas y operaciones en el esquema **`logistica`** (`logistica.*`). Copia `.env.example` a `.env` (el archivo `.env` está en `.gitignore` y no se sube al repositorio):
```env
DATABASE_URL="postgresql://<USUARIO>:<PASSWORD_URL_ENCODED>@<HOST_NEON>:5432/si2_22026?schema=logistica&sslmode=require"
```

### 2. Migrar y Poblar la Base de Datos
**Base nueva o local** (crea las tablas y carga datos de prueba):
```bash
# Ejecutar DDL, generar cliente Prisma y poblar datos iniciales
npm run db:setup
```

**Base que ya tiene datos** (por ejemplo, la compartida en Neon), solo aplicar los cambios de esquema:
```bash
npm run db:ddl        # ejecuta en orden db/ddl/001, 002, ... (idempotentes)
npm run db:generate
```

> ⚠️ `db:setup` y `db:seed` **borran** los datos de las tablas de logística antes de cargar los de prueba. No usarlos contra la base compartida. Antes de migrar Neon, respaldar el esquema: `pg_dump -n logistica`.

### 3. Ejecutar la Aplicación en Modo Desarrollo
Ejecuta simultáneamente el Backend (Express en `:3001`) y el Frontend (Vite en `:5173`):
```bash
npm run dev
```

Abre en tu navegador: **`http://localhost:5173`**

### 4. Ejecutar el Backend en Docker (Para Integración con Otros Módulos)

Si otro módulo (Ventas, Inventario, RRHH) o el equipo docente necesita consumir la API REST de Logística localmente sin instalar dependencias de Node.js:

```bash
# Construir y levantar el backend de Logística en segundo plano
docker compose up --build -d server
# o bien usando el script de npm:
npm run docker:server
```

La API quedará inmediatamente disponible en **`http://localhost:3001`**:
* **Health Check:** `GET http://localhost:3001/api/health`
* **Ver logs:** `npm run docker:server:logs` (o `docker compose logs -f server`)
* **Detener contenedor:** `npm run docker:server:stop` (o `docker compose stop server`)

### 5. Integración con Inventario

Logística consulta y confirma stock en la API REST de Inventario (`server/src/integrations/inventario/`). Se configura en el `.env` de la raíz:

| Variable | Valor |
|---|---|
| `INVENTARIO_API_URL` | URL base con `/api/v1`. **Vacía = modo simulado**: no se llama a Inventario y se usan datos en memoria |
| `INVENTARIO_API_KEY` | API key del módulo `logistica`, entregada por Inventario (se envía como `Authorization: Bearer`) |
| `INVENTARIO_TIMEOUT_MS` | Espera máxima por llamada (por defecto `8000`) |

- Si Inventario corre en tu máquina, la URL es `http://localhost:3000/api/v1` con `npm run dev` y `http://host.docker.internal:3000/api/v1` desde el contenedor.
- Al iniciar, el servidor indica en consola si usa el cliente **REAL** o **SIMULADO**.
- `GET /api/logistica/integraciones/inventario` muestra el modo y si Inventario responde (`503` si no).

---

## Endpoints de la API REST (`/api/logistica`)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/logistica/pedidos-pendientes` | Lista órdenes de trabajo y estado de picking |
| `GET` | `/api/logistica/ots/:id` | Detalle de OT, productos, empaque sugerido y dirección |
| `GET` | `/api/logistica/transportistas` | Transportistas y servicios activos |
| `POST` | `/api/logistica/cotizar` | Cotización y validación de cobertura en vivo |
| `POST` | `/api/logistica/guias` | Emisión de Guía de Despacho y confirmación del egreso con Inventario |
| `POST` | `/api/logistica/guias/:id/reintentar-stock` | Reintenta la confirmación de stock de una guía en `Pendiente de stock` o `Error de stock` |
| `GET` | `/api/logistica/tracking` | Consulta con filtros (`busqueda`, `estado`, `transportista`, `fecha`) |
| `POST` | `/api/logistica/tracking/:id_guia/evento` | Inserción en bitácora append-only y actualización de estado |
| `GET` | `/api/logistica/integraciones/inventario` | Modo del cliente de Inventario (real o simulado) y si responde |
| `GET` | `/api/health` | Estado del servicio y conexión a BD |
