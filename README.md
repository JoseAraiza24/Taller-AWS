# Taller AWS — Amazon Lite

**José Antonio Araiza Cortés**

Backend académico de una tienda con TypeScript, Serverless Framework 3, AWS Lambda, API Gateway y DynamoDB. Se puede ejecutar con Docker y LocalStack. Incluye los cuatro módulos del taller, CORS para conectar un frontend y recursos separados por entorno.

## Módulos

| Carpeta | Responsabilidad |
| --- | --- |
| `Amazon_Lite/taller-gateway` | API compartida, ping y autorizador JWT |
| `Amazon_Lite/taller-users` | Registro, login, consulta, actualización y eliminación del usuario |
| `Amazon_Lite/taller-products` | CRUD de productos, listados y stock |
| `Amazon_Lite/taller-orders` | Creación, consulta, listado, confirmación y cancelación de órdenes |

Cada módulo conserva su configuración, código fuente y archivos `package.json` y `package-lock.json`. Las lambdas se empaquetan individualmente con esbuild.

## Ejecutar en LocalStack

Requisitos: Node.js 22 o superior, NPM, Git, AWS CLI, Docker y un token de LocalStack con acceso a los servicios usados. El contexto Docker predeterminado del taller es `orbstack`; para Docker Desktop se puede pasar `TALLER_DOCKER_CONTEXT=default` al comando `scripts/entorno`.

```bash
npm ci
npm run install:modules
./scripts/configurar-token
./scripts/entorno iniciar
npm run prepare:local
npm run deploy:local
npm run endpoints:local
```

`configurar-token` solicita el token de forma oculta y lo guarda en `.env`, con permisos 600. El entorno local fija `127.0.0.1:4566`, región `us-east-1`, y credenciales ficticias `test`; no utiliza perfiles personales de AWS.

El orden de despliegue es **Gateway → Users → Products → Orders**. La API se obtiene del export `MainRestApiId-local`. El frontend debe usar esa URL como base y agregar las rutas correspondientes. Los tokens se envían con `Authorization: Bearer ...`.

La conservación de datos al reiniciar LocalStack depende de su licencia y configuración de persistencia. `./scripts/entorno detener` detiene el contenedor sin borrarlo.

## Conexión con el frontend

Los 18 handlers HTTP exportan `withCors(handler)`, definido en `src/common/cors.ts` de cada módulo. El middleware compara `Origin` con `CORS_ORIGINS`, agrega los encabezados y métodos permitidos, maneja `OPTIONS` y conserva CORS en respuestas de error. Un origen no permitido no recibe `Access-Control-Allow-Origin`. Se añade `Vary: Origin` y no se habilitan cookies entre orígenes.

API Gateway también configura CORS, preflight público y respuestas de error. El plugin local `scripts/serverless-cors.cjs` corrige el JSON de las plantillas MOCK generadas por Serverless 3 y reconcilia los métodos OPTIONS del API compartido en LocalStack después de cada despliegue. En AWS se utilizan los métodos declarados en CloudFormation. El autorizador JWT conserva su contrato de política de acceso y no usa el wrapper HTTP.

En `local` y `develop` se permite `http://localhost:3000`. El protocolo, dominio y puerto deben coincidir con el frontend. Para usar otro origen, modifica `config/config-<entorno>.json` en los cuatro módulos y vuelve a desplegar. CORS controla qué respuestas puede leer el navegador; los permisos y la autenticación se siguen verificando mediante JWT.

## Entornos y producción

Los exports e imports compartidos incorporan el stage:

| Recurso | Local | Producción |
| --- | --- | --- |
| API | `MainRestApiId-local` | `MainRestApiId-prod` |
| Recurso raíz | `MainRestApiRootResourceId-local` | `MainRestApiRootResourceId-prod` |
| Autorizador | `MainAuthorizerId-local` | `MainAuthorizerId-prod` |

Las lambdas, tablas, stacks y parámetros SSM también se nombran por entorno. `develop` y `prod` pueden coexistir sin colisiones de exports. Para migrar una instalación anterior se añaden primero los nombres nuevos, se actualizan los consumidores y luego se retiran los antiguos; no es necesario eliminar las tablas.

`config-prod.json` usa **`https://amazon-lite.example.com` como dominio de ejemplo**. Antes de un despliegue real hay que sustituirlo por el dominio HTTPS del frontend en los cuatro módulos, configurar las credenciales y permisos de AWS y crear parámetros SSM SecureString exclusivos de producción:

```text
/taller/prod/jwt-secret
/taller/prod/jwt-refresh-secret
```

También pueden suministrarse `JWT_SECRET` y `JWT_REFRESH_SECRET` al proceso; si no están presentes, Serverless resuelve los parámetros SSM del stage. No hay valores de secretos en el repositorio.

Desde una cuenta AWS preparada, el despliegue sigue el mismo orden:

```bash
npm --prefix Amazon_Lite/taller-gateway run deploy:prod
npm --prefix Amazon_Lite/taller-users run deploy:prod
npm --prefix Amazon_Lite/taller-products run deploy:prod
npm --prefix Amazon_Lite/taller-orders run deploy:prod
```

Cada módulo también dispone de `deploy:develop`. Estos comandos se distinguen de `deploy:local`, que usa exclusivamente LocalStack. La validación del proyecto se realiza localmente; la configuración de producción no implica que se haya desplegado en una cuenta AWS.

## Comprobaciones

```bash
npm run typecheck
npm test
npm run verify:local
node scripts/verificar-cors-local.cjs
npm run check:prod
```

Las pruebas unitarias cubren el autorizador y CORS en los cuatro módulos. Las verificaciones locales ejercitan las peticiones reales y limpian sus propios datos sintéticos. La comprobación de CORS recorre los 18 endpoints y sus preflight. `check:prod` compila las plantillas de `develop` y `prod` con valores JWT efímeros de prueba: comprueba nombres, imports, exports y orígenes sin desplegar recursos ni leer secretos reales. Sus archivos generados quedan ignorados en `.serverless` y `evidencias`.

Serverless 3 puede mostrar una advertencia porque su esquema de validación es anterior a Node.js 22; las funciones utilizan Node.js 22.

## Control de versiones

- `main`: versión verificada para la entrega.
- `develop`: integración y preparación de cambios.

Los cambios se prueban en `develop` antes de integrarlos a `main`. No se publican `node_modules`, `.serverless`, archivos `.env`, capturas, reportes ni registros de ejecución. Las dependencias se reproducen con los archivos lock y `npm ci`.

## Alcance académico

En esta instalación de LocalStack no se ejecuta el autorizador CUSTOM. Para `STAGE=local`, las lambdas protegidas verifican también el JWT; en AWS usan el contexto del autorizador de API Gateway. Se conserva la configuración del autorizador compartido.

Cancelar una orden conserva el registro y cambia su estado; no repone automáticamente inventario. Las reservas de varios productos no implementan compensación distribuida y un vendedor participante puede confirmar toda la orden, como en el taller. El índice de correo no garantiza unicidad transaccional ante registros simultáneos.
