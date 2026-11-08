# Taller Products — Amazon Lite

Módulo de los videos 31, 32 y 33, desplegado en LocalStack con Serverless Framework 3. Comparte el API Gateway y el autorizador del módulo Gateway.

## Peticiones

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/products/create` | Vendedor autenticado |
| GET | `/products/{id}` | Público |
| PUT | `/products/{id}` | Vendedor propietario |
| DELETE | `/products/{id}` | Vendedor propietario |
| GET | `/products` | Público |
| GET | `/products/users/{sellerId}` | Público |
| PATCH | `/products/{id}/stock` | Usuario autenticado |

El cuerpo de creación contiene `name`, `description`, `price` y `stock`. PUT permite modificar esos campos parcialmente. PATCH recibe `{ "quantity": 3 }` y descuenta tres unidades. Una condición atómica de DynamoDB impide consumir más unidades de las disponibles, incluso con solicitudes simultáneas. Para reponer stock se usa PUT.

La tabla `taller-products-local-products` usa `productId` como clave y `seller-index` para consultar los productos de un vendedor. Los listados recorren todas las páginas de DynamoDB.

## Ejecución local

Se necesitan Docker/LocalStack en ejecución y los módulos Gateway y Users desplegados, con sus parámetros SSM locales.

```sh
npm ci
npm run typecheck
npm run deploy:local -- --force
```

El comando de despliegue muestra las siete funciones y después las siete rutas consultadas del API Gateway local. `npm run endpoints:local` vuelve a consultar y mostrar las rutas sin desplegar. Serverless 3 puede advertir que su esquema antiguo no reconoce `nodejs22.x`; el runtime usado por LocalStack es Node.js 22.

## Insomnia

Las siete solicitudes están en Scratch Pad → `09 · Products`. El vendedor de práctica utiliza el nombre y correo confirmados por el alumno. Los tokens se guardan en variables locales y no forman parte de la entrega.

`npm run prepare:insomnia` prepara un vendedor con rol `seller` e imprime únicamente su información pública. No cambia el rol de un usuario existente. Genera `.env.insomnia-products.json`, un archivo privado para importar en Insomnia. Después de ejecutar Create product, se copia el `productId` devuelto a la variable `products_product_id` del Base Environment. Se ejecutan las otras peticiones sobre ese mismo producto y se deja DELETE al final.

Las capturas de la actividad están en `../../output/actividad-9/`. Son capturas nativas de Insomnia después de peticiones reales. La captura de terminal la toma manualmente el alumno usando `Comandos_terminal.txt`.

## Validación

`npm run verify:local` prueba 24 casos contra los servicios desplegados: creación, lecturas, ambos listados, permisos, datos inválidos, actualización parcial, decrementos de stock, dos solicitudes simultáneas para la última unidad y eliminación. Genera el detalle en `../../evidencias/09-products/verificacion.json` y limpia exclusivamente sus registros sintéticos de prueba.

En esta instalación de LocalStack se observó que API Gateway no ejecuta el autorizador CUSTOM. Por ello, las lambdas protegidas verifican también el JWT cuando `STAGE=local`; se conserva la configuración del autorizador compartido. Fuera del entorno local, el código obtiene la identidad del contexto del autorizador de API Gateway.

Los archivos `.env*` contienen datos privados de la práctica, están excluidos de Git y no deben incluirse en las entregas.

## Conexión y entornos

Los handlers HTTP usan `src/common/cors.ts` y la configuración CORS del stage. Las referencias compartidas son `MainRestApiId-<stage>`, `MainRestApiRootResourceId-<stage>` y `MainAuthorizerId-<stage>`. Se incluyen configuraciones `local`, `develop` y `prod`; el dominio HTTPS de producción es un ejemplo que debe reemplazarse antes de desplegar. Consulta las instrucciones generales en [README del proyecto](../../README.md).
