# Taller Gateway — Actividad 6

Módulo Amazon Lite con dos lambdas en TypeScript:

- `ping`: responde a `GET /gateway/ping` con un JSON de confirmación.
- `authorizer`: verifica un JWT y devuelve una política de API Gateway con `userId` y `role`.

Se utiliza Serverless Framework 3 por elección del alumno, para desplegar en LocalStack
sin otra cuenta. `serverless-esbuild` compila TypeScript; `serverless-localstack`
redirige el despliegue a `127.0.0.1:4566`. El runtime de las lambdas es Node.js 22.

Desde esta carpeta:

```bash
npm ci
npm run typecheck
npm test
npm run prepare:local
npm run deploy:local
npm run info:local
npm run verify:local
```

Antes del despliegue, el LocalStack del taller debe estar iniciado con el comando
`./scripts/entorno iniciar` desde la raíz del taller. La preparación crea un secreto JWT
aleatorio en SSM local y conserva su valor si ya existe. No muestra el secreto.

Los scripts locales usan credenciales ficticias `test` y no leen los perfiles personales
de AWS. El despliegue crea API Gateway, las dos lambdas, el autorizador, respuestas de
error con CORS, un plan de uso, una API key y las salidas compartidas para otros módulos.
El endpoint ping es público, como queda al final del video de despliegue.
La verificación comprueba el HTTP 200 del ping y el autorizador desplegado: acepta
un JWT válido y rechaza firma incorrecta, token vencido y token vacío.

Serverless 3 muestra un aviso porque su esquema antiguo no enumera Node.js 22.
La compilación con esbuild y el runtime Node.js 22 de ambas lambdas se comprobaron
en LocalStack.

`npm run remove:local` elimina este despliegue local cuando ya no se necesite.
La persistencia de LocalStack está desactivada: al reiniciar el contenedor puede ser
necesario repetir la preparación y el despliegue.

La entrega original de la actividad 5 se conserva en
`../../evidencias/06-deploy-gateway/actividad-5-original/`.

## Conexión y entornos

Los handlers HTTP usan `src/common/cors.ts` y la configuración CORS del stage. Las referencias compartidas son `MainRestApiId-<stage>`, `MainRestApiRootResourceId-<stage>` y `MainAuthorizerId-<stage>`. Se incluyen configuraciones `local`, `develop` y `prod`; el dominio HTTPS de producción es un ejemplo que debe reemplazarse antes de desplegar. Consulta las instrucciones generales en [README del proyecto](../../README.md).
