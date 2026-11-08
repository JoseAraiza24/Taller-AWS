# Taller Users — Actividad 7

Registro de usuarios de Amazon Lite en LocalStack, basado en el módulo del video 27.
Comparte API Gateway con Taller Gateway mediante `MainRestApiId-<stage>` y
`MainRestApiRootResourceId-<stage>`. Utiliza Serverless Framework 3, TypeScript y esbuild,
como se eligió en la actividad anterior.

El endpoint `POST /users/register` recibe `email`, `password`, `name` y `role`
(`buyer` por defecto o `seller`). Valida los datos, consulta el índice `email-index`
y guarda el usuario con un UUID y contraseña hasheada con bcrypt. La respuesta HTTP
200 contiene los datos públicos; excluye la contraseña.

Recursos:

- Lambda `taller-local-Users-Register`.
- Tabla `taller-users-local-users`, llave `userId` e índice `email-index`.
- Tabla `taller-users-local-refresh-tokens`, llave `token` y TTL en `expiresAt`.
- Permisos de DynamoDB sobre las tablas del módulo y el índice de usuarios.

Desde esta carpeta, con LocalStack y Taller Gateway ya desplegados:

```bash
npm ci
npm run typecheck
npm run prepare:local
npm run deploy:local
npm run verify:local
npm run endpoints:local
```

`verify:local` prueba el registro real, el hash, la omisión de contraseña, el correo
duplicado y las entradas inválidas. Elimina únicamente su propio usuario sintético
de prueba. El índice de correo se consulta como en el video; esto no proporciona
una restricción transaccional de unicidad entre solicitudes simultáneas.

El cliente DynamoDB usa `AWS_ENDPOINT_URL` dentro de Lambda para alcanzar LocalStack
desde Docker. Los comandos locales usan credenciales ficticias y no leen los perfiles
personales de AWS. El aviso de runtime de Serverless 3 proviene de su esquema anterior
a Node.js 22; las lambdas usan Node.js 22 en LocalStack.

## Insomnia y evidencias

La petición se creó y ejecutó en Insomnia nativo, dentro del Scratch Pad local.
La contraseña de práctica está en `.env.practica.json`, con permisos 600 y excluida
de Git. En Insomnia se referencia mediante la variable local `practice_password`.
`.env.insomnia.json` conserva una copia importable de la petición con los datos de
práctica. Estos archivos privados no forman parte de las entregas.

La captura del usuario creado está en
`../../output/actividad-7/Actividad_7_Usuario_creado_Insomnia.jpg`.

Para la captura de terminal solicitada por el profesor:

```bash
clear
npm run deploy:local -- --force
```

Captura el resultado final del despliegue y los endpoints completos que aparecen al
final. El despliegue no elimina ni vuelve a registrar al usuario existente. Reenviar
su petición de registro devolverá HTTP 400 porque el correo ya está registrado.

Los registros reales del despliegue, las comprobaciones y el usuario público están en
`../../evidencias/07-users-registro/`.

## Actividad 8 — Login y operaciones sobre el usuario

Se añadieron las lambdas `login`, `getUser`, `updateUser` y `deleteUser` siguiendo los
videos 28, 29 y 30. El login emite un access token de una hora y un refresh token de
siete días; guarda este último en DynamoDB con TTL numérico en segundos Unix.
El endpoint de refresh queda pendiente para otro módulo, como en el video.

Rutas del módulo:

| Método | Ruta | Autorización |
| --- | --- | --- |
| POST | `/users/register` | Pública |
| POST | `/users/login` | Pública |
| GET | `/users/{id}` | JWT válido |
| PUT | `/users/{id}` | JWT del mismo usuario; recibe `name` |
| DELETE | `/users/{id}` | JWT del mismo usuario |

Las rutas protegidas importan `MainAuthorizerId-<stage>`. Se desactivó la caché del autorizador
en Taller Gateway para mantener políticas por método sin reutilizar la política de
una ruta para otra. Las pruebas detectaron que esta instancia LocalStack acepta la
configuración `CUSTOM` pero omite la ejecución del autorizador, incluso con una nueva
implementación de la API y en sus distintas URL de invocación. Para `STAGE=local`,
`src/lib/auth.ts` verifica además el mismo JWT dentro de cada lambda protegida. En
AWS se utiliza el contexto del autorizador de API Gateway.

`npm run verify:crud:local` comprueba el flujo completo con dos usuarios sintéticos:
login, duración y almacenamiento de tokens, autorización, consulta, actualización,
bloqueo de acciones sobre otro usuario, eliminación y errores posteriores a la
eliminación. Limpia únicamente sus propios usuarios y refresh tokens de prueba.
Los resultados están en `../../evidencias/08-users/`.

Las capturas de la actividad 8 se realizan en Insomnia nativo. El login guarda
automáticamente sus tokens como variables locales para las demás peticiones. Las
capturas originales se guardan en `../../output/actividad-8/`.

## Conexión y entornos

Los handlers HTTP usan `src/common/cors.ts` y la configuración CORS del stage. Las referencias compartidas son `MainRestApiId-<stage>`, `MainRestApiRootResourceId-<stage>` y `MainAuthorizerId-<stage>`. Se incluyen configuraciones `local`, `develop` y `prod`; el dominio HTTPS de producción es un ejemplo que debe reemplazarse antes de desplegar. Consulta las instrucciones generales en [README del proyecto](../../README.md).
