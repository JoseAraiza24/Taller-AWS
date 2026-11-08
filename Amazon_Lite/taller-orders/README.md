# Taller Orders — Amazon Lite

Módulo de los videos 34, 35 y 36. Utiliza Serverless Framework 3, DynamoDB y la invocación síncrona de lambdas de Products. Los servicios se ejecutan en LocalStack.

## Peticiones

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/orders/create` | Usuario autenticado |
| GET | `/orders/{id}` | Autor de la orden |
| GET | `/orders/list/users/{userId}` | El mismo usuario del token |
| POST | `/orders/{id}/confirm` | Vendedor con productos en la orden |
| POST | `/orders/{id}/cancel` | Autor o vendedor con productos en la orden |

Create recibe `{ "items": [{ "productId": "...", "quantity": 2 }] }`. Obtiene el precio actual mediante GetProduct, calcula el total, guarda una orden `pending` y reserva las cantidades mediante UpdateStock. Se ignoran el precio, el total y la identidad que pudiera enviar el cliente. Los productos repetidos se agrupan antes de validar el stock.

Get devuelve `{ "order": {...} }` y List devuelve `{ "orders": [...] }`. El listado recorre todas las páginas del índice `user-orders-index` y ordena por `createdAt` descendente. Confirm y Cancel devuelven un mensaje y la orden actualizada para que el estado se vea directamente en la evidencia. Ambas transiciones requieren `pending` y usan una condición de DynamoDB para impedir dos cambios incompatibles simultáneos.

## Despliegue local

Se necesitan LocalStack en ejecución, Gateway, Users y Products desplegados y el parámetro SSM local del JWT.

```sh
npm ci
npm run typecheck
npm run deploy:local -- --force
```

El despliegue muestra las cinco funciones y después consulta API Gateway para imprimir las cinco rutas reales. `npm run endpoints:local` permite consultar las rutas sin volver a desplegar. Las credenciales de los scripts son ficticias y los perfiles personales de AWS quedan desactivados.

Se mantiene Node.js 22 y Serverless 3 por la configuración elegida para el taller. Serverless 3 puede mostrar una advertencia de esquema sobre ese runtime, aunque LocalStack lo ejecuta. Orders y Products tienen un tiempo límite de 30 segundos para las llamadas locales entre lambdas.

## Insomnia y evidencias

`npm run prepare:insomnia` inicia sesión con la cuenta de práctica existente, prepara dos productos ficticios propios y genera `.env.insomnia-orders.json` para importar como colección local. No crea las órdenes que se fotografían. La cuenta `seller` de José Antonio Araiza Cortés puede crear órdenes y también confirmar las que contienen productos propios; el video 34 permite crear órdenes a cualquier usuario autenticado.

Se ejecuta Create order desde Insomnia y se copia su `orderId` a `orders_order_id` en Base Environment. Después se ejecutan Get, List y Confirm. Se vuelve a ejecutar Create para obtener una segunda orden `pending`, cuyo ID se guarda en `orders_cancel_order_id`, y se ejecuta Cancel. Así se conserva una orden confirmada y otra cancelada sin alterar artificialmente sus estados.

Las capturas nativas se guardan en `../../output/actividad-10/`. La captura de terminal la toma manualmente el alumno con `Comandos_terminal.txt`. Los archivos `.env*` contienen tokens locales y están excluidos de Git y de las entregas.

## Validación y alcance

`npm run verify:local` completó 41 comprobaciones de las peticiones reales, entradas inválidas, JWT, permisos de comprador y vendedor, productos inexistentes, stock insuficiente, precio capturado, reserva mediante Lambda, listado exclusivo del usuario y transiciones de estado simultáneas. Guarda sus resultados en `../../evidencias/10-orders/verificacion.json` y limpia exclusivamente sus datos sintéticos.

Se conserva el alcance didáctico de los videos: cualquier vendedor con al menos un producto en la orden puede confirmar toda la orden. Cancelar cambia el estado y conserva el registro; no repone automáticamente el inventario. La creación y las reservas de varios productos no forman una transacción distribuida. Si una reserva posterior falla, la orden se marca `canceled`, pero las reservas anteriores requieren una compensación que el taller no implementa.

Esta instalación de LocalStack no ejecuta el autorizador CUSTOM de API Gateway. Las rutas protegidas verifican el JWT dentro de la lambda cuando `STAGE=local`, conservando el autorizador compartido en Serverless. Orders reenvía el Bearer validado al invocar UpdateStock. IAM limita la invocación a las tres funciones de Products utilizadas: GetProduct, UpdateStock y ListProductsBySeller.
