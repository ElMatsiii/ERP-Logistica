# Contrato de Integración: Logística y Transporte ↔ Ventas / E-commerce
**LesGo ERP — Sistemas de Información II (UCN)**  
*Módulo Emisor / Proveedor de Servicio: Logística y Transporte (Puerto 3001)*  
*Módulo Consumidor: Ecommerce y Ventas*

---

## 1. Resumen de la Integración

Este documento define la interfaz de comunicación HTTP REST entre el módulo de **Ecommerce/Ventas** y el módulo de **Logística y Transporte**, dando respuesta exacta a los requerimientos acordados:

* **Lo que Ventas entrega a Logística (Entregable):**
  * Información del pedido pagado (`id_pedido`, productos, montos).
  * Datos de entrega (`direccion_entrega`, `comuna_entrega`, `telefono_contacto`).
* **Lo que Logística entrega a Ventas (Recibo):**
  * Código de seguimiento / tracking number único (`num_seguimiento`, ej: `CHI-929485-CL`).
  * Precio final y tipo de envío asignado (ej: `Chilexpress Prioritario (24h)` - `$6.900`).
  * Estado y bitácora de seguimiento en tiempo real (`PREPARADO`, `EN_TRANSITO`, `ENTREGADO_CONFORME`).
* **Lógica de envíos en checkout (Preguntar):**
  * Cotización dinámica de couriers y plazos de entrega según comuna de destino.

---

## 2. URL Base y Configuración

```env
# En el .env del módulo de Ventas:
LOGISTICA_API_URL=http://localhost:3001
```

*Las rutas están disponibles tanto bajo `/api/logistica/ventas/*` como bajo el alias directo `/api/ventas-integration/*`.*

---

## 3. Especificación de Endpoints

### Endpoint 1: Cotizar Envío y Opciones de Couriers (Checkout)
*Permite a Ventas calcular el costo de envío y mostrárselo al cliente en el carrito antes de pagar.*

* **Método:** `POST`
* **Ruta:** `/api/logistica/ventas/cotizar-envio`
* **Headers:** `Content-Type: application/json`
* **Body Request:**
```json
{
  "comuna_destino": "La Serena",
  "peso_kg": 2.5,
  "productos": [
    {
      "id_producto": 4,
      "cantidad": 1
    }
  ]
}
```
* **Respuesta Exitosa (`200 OK`):**
```json
{
  "comuna_destino": "La Serena",
  "total_bultos": 1,
  "peso_cobrado_kg": 2.73,
  "opciones_envio": [
    {
      "transportista_id": 2,
      "transportista": "Starken",
      "servicio_id": 4,
      "tipo_envio": "Starken Normal a Domicilio",
      "dias_entrega_estimados": 2,
      "peso_facturable_kg": 2.73,
      "precio_envio": 3800,
      "cobertura": true
    },
    {
      "transportista_id": 1,
      "transportista": "Chilexpress",
      "servicio_id": 1,
      "tipo_envio": "Chilexpress Prioritario (24h)",
      "dias_entrega_estimados": 1,
      "peso_facturable_kg": 2.73,
      "precio_envio": 4500,
      "cobertura": true
    }
  ]
}
```

---

### Endpoint 2: Solicitar Despacho de Pedido (Generación de Guía y Tracking)
*Ventas notifica que un pedido ha sido pagado y requiere despacho. Logística genera la guía, reserva el courier y retorna el código de seguimiento.*

* **Método:** `POST`
* **Ruta:** `/api/logistica/ventas/solicitar-despacho`
* **Headers:** `Content-Type: application/json`
* **Body Request (Lo que Ventas entrega):**
```json
{
  "id_pedido": 15,
  "cliente_nombre": "Martín Almeyda",
  "cliente_rut": "17.291.844-3",
  "direccion_entrega": "Balmaceda 1234",
  "comuna_entrega": "La Serena",
  "ciudad_entrega": "La Serena",
  "telefono_contacto": "912345678",
  "transportista_preferido": "Chilexpress",
  "productos": [
    {
      "id_producto": 4,
      "sku": "60271-1",
      "nombre": "Main Square",
      "cantidad": 1
    }
  ]
}
```
* **Respuesta Exitosa (`201 Created`) (Lo que Ventas recibe):**
```json
{
  "status": "ok",
  "mensaje": "Despacho recepcionado y programado exitosamente",
  "id_pedido": 15,
  "codigo_seguimiento": "CHI-929485-CL",
  "num_seguimiento": "CHI-929485-CL",
  "guia_despacho_id": "GD-59682",
  "transportista": "Chilexpress",
  "tipo_envio": "Chilexpress Prioritario (24h)",
  "precio_envio": 6900,
  "estado_envio": "PREPARADO",
  "dias_transito_estimados": 1,
  "fecha_estimada_entrega": "2026-11-17T20:48:31.631Z",
  "tracking_url": "http://localhost:3001/api/logistica/ventas/tracking/15"
}
```
*Efecto colateral automático:* Logística actualiza en la base de datos de Neon el pedido `ecommerce_ventas.ecom_pedido` a `estado = 'enviada'`.

---

### Endpoint 3: Consultar Tracking de Envío en Tiempo Real
*Permite a Ventas consultar el estado actual y los hitos del paquete para mostrárselo al cliente en la web.*

* **Método:** `GET`
* **Ruta:** `/api/logistica/ventas/tracking/:criterio`  
  *(donde `:criterio` puede ser el `id_pedido` numérico ej. `15`, o el código de seguimiento ej. `CHI-929485-CL`)*
* **Respuesta Exitosa (`200 OK`):**
```json
{
  "encontrado": true,
  "id_pedido": "15",
  "codigo_seguimiento": "CHI-929485-CL",
  "guia_despacho_id": "GD-59682",
  "transportista": "Chilexpress",
  "tipo_envio": "Chilexpress Prioritario (24h)",
  "precio_envio": 6900,
  "estado_actual": "PREPARADO",
  "fecha_emision": "2026-11-16T20:48:31.631Z",
  "direccion_destino": "Av. Cuatro Esquinas 1420, La Serena",
  "historial_eventos": [
    {
      "fecha": "2026-11-16T20:48:31.890Z",
      "estado": "PREPARADO",
      "observacion": "Guía emitida exitosamente para OT OT-ECOM-15 con tracking CHI-929485-CL",
      "responsable": "Integración E-commerce Ventas"
    }
  ]
}
```

---

### Endpoint 4: Listar Pedidos Pagados Pendientes de Despacho
*Consulta en tiempo real los pedidos de la base de datos de Ventas con `LOWER(estado) = 'pagada'`.*

* **Método:** `GET`
* **Ruta:** `/api/logistica/ventas/pedidos-pendientes`
* **Respuesta Exitosa (`200 OK`):**
```json
{
  "total": 5,
  "pedidos": [
    {
      "id_pedido": 16,
      "numero_pedido": "PED-00016",
      "id_cliente": 1,
      "cliente_nombre": "Cliente #1",
      "fecha_pedido": "2026-11-15T00:00:00.000Z",
      "monto_total": 80000,
      "estado": "Pagada",
      "direccion_entrega": "Balmaceda 1234",
      "comuna_entrega": "La Serena",
      "ciudad_entrega": "La Serena",
      "telefono_contacto": "912345678",
      "metodo_pago": "tarjeta",
      "productos": [
        {
          "id_producto": 2,
          "sku": "60473-1",
          "nombre": "The City Tower",
          "cantidad": 1,
          "precio_unitario": 80000,
          "peso_unitario_kg": 3.5
        }
      ]
    }
  ]
}
```

---

## 4. Guía de Conexión Rápida para el Backend de Ventas

En el repositorio de Ventas (`backend/controllers/pedidosController.js`), actualmente el tracking se obtiene de un mock en memoria (`getEnvioPorPedido`). 

Para conectar con la API real de Logística manteniendo compatibilidad total con su componente `OrderDetailModal.tsx`, solo deben reemplazar la llamada por una función asíncrona:

```javascript
// En Ventas: backend/controllers/pedidosController.js
// Reemplazar: const envio = getEnvioPorPedido(pedido.id_pedido);
// Por:
let envio = null;
try {
  const resp = await fetch(`http://localhost:3001/api/logistica/ventas/tracking/${pedido.id_pedido}`, {
    signal: AbortSignal.timeout(2000)
  });
  if (resp.ok) {
    const data = await resp.json();
    if (data.encontrado) {
      envio = data; // Contiene exactamente courier, numero_seguimiento, estado_envio, fecha_entrega_estimada, eventos
    }
  }
} catch (e) {
  // Fallback al mock si Logística está desconectado
  envio = getEnvioPorPedido(pedido.id_pedido);
}
```
*La respuesta de Logística respeta 100% los nombres de campos que su modal `OrderDetailModal.tsx` ya consume.*
