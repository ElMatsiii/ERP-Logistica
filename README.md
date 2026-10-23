# LesGo ERP — Módulo de Logística y Transporte 🧱🚚
**Sprint 2: Desarrollo Inicial MVP**  
*Asignatura: Sistemas de Información II — Universidad Católica del Norte (UCN)*  
*Grupo 6: Maximiliano Pizarro, Máximo Sazo, Nicolás Rojas, Daniela Infante, Javier Catalán, Bastián Salinas.*

---

## 🌟 Resumen del Proyecto

Este módulo implementa la solución integral de **Logística y Transporte** para el ERP de **"LesGo"** (tienda especializada en sets emblemáticos de LEGO). Cubre el ciclo completo desde la validación de órdenes de trabajo recolectadas (*picking*), cubicación volumétrica en tiempo real, selección de transportistas y emisión de Guías de Despacho transaccionales con rebaja de existencias en Inventario (`inv_mov`), hasta la consola de seguimiento y bitácora cronológica (*tracking*).

---

## 🏗️ Stack Tecnológico y Arquitectura

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
  - Esquema modelado con prefijo `log_*` (12 entidades) y tabla cruzada `inv_mov`.
  - Script de Seed `prisma/seed.ts` con más de 10 registros reales por tabla.

---

## 🗄️ Modelo de Datos (13 Tablas Modeladas)

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
13. `inv_mov`: Movimientos de egreso de inventario tipo `SALIDA`.

---

## ⚙️ Reglas de Negocio Implementadas

1. **Validación de Estado OT**:
   - Solo se permite emitir guía si la orden de trabajo se encuentra estrictamente en estado `CERRADO`. Si no lo está, el frontend bloquea la acción y el backend responde `HTTP 422: "No se puede emitir guía: la OT no se encuentra en estado CERRADO"`.
2. **Validación de Cobertura Vigente**:
   - Se valida que la comuna de destino del cliente posea cobertura activa (`vigente = true`) para el transportista y servicio seleccionado. En caso contrario, se responde `HTTP 422`.
3. **Validación de Dimensiones y Pesos**:
   - El peso real y las tres dimensiones del bulto deben ser estrictamente mayores a cero (`HTTP 400`).
4. **Cálculo de Cubicación Volumétrica**:
   - Peso Volumétrico = $\frac{\text{Largo} \times \text{Alto} \times \text{Ancho}}{\text{Factor Volumétrico}}$ (default 5000 o según transportista).
   - Peso a Cobrar = $\max(\text{Peso Real}, \text{Peso Volumétrico})$.
5. **Transaccionalidad Atómica**:
   - En una única transacción Prisma `$transaction`, se crea la guía, el bulto, el evento inicial en bitácora y el egreso en inventario `inv_mov`.

---

## 🚀 Puesta en Marcha

### 1. Configuración de Conexión a Base de Datos (Neon PostgreSQL)
El proyecto se conecta al servidor compartido de la asignatura en Neon PostgreSQL, aislando todas sus tablas y operaciones en el esquema **`logistica`** (`logistica.*`). Copia `.env.example` a `.env` (el archivo `.env` está en `.gitignore` y no se sube al repositorio):
```env
DATABASE_URL="postgresql://<USUARIO>:<PASSWORD_URL_ENCODED>@<HOST_NEON>:5432/si2_22026?schema=logistica&sslmode=require"
```

### 2. Migrar y Poblar la Base de Datos
```bash
# Generar cliente Prisma y empujar esquema
npm run db:push

# Ejecutar el seed con más de 10 registros por tabla
npm run db:seed
```

### 3. Ejecutar la Aplicación en Modo Desarrollo
Ejecuta simultáneamente el Backend (Express en `:3001`) y el Frontend (Vite en `:5173`):
```bash
npm run dev
```

Abre en tu navegador: **`http://localhost:5173`**

---

## 📋 Endpoints de la API REST (`/api/logistica`)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/logistica/pedidos-pendientes` | Lista órdenes de trabajo y estado de picking |
| `GET` | `/api/logistica/ots/:id` | Detalle de OT, productos, empaque sugerido y dirección |
| `GET` | `/api/logistica/transportistas` | Transportistas y servicios activos |
| `POST` | `/api/logistica/cotizar` | Cotización y validación de cobertura en vivo |
| `POST` | `/api/logistica/guias` | Emisión transaccional de Guía de Despacho |
| `GET` | `/api/logistica/tracking` | Consulta con filtros (`busqueda`, `estado`, `transportista`, `fecha`) |
| `POST` | `/api/logistica/tracking/:id_guia/evento` | Inserción en bitácora append-only y actualización de estado |
| `GET` | `/api/health` | Estado del servicio y conexión a BD |
