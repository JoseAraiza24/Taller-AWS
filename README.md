# Taller de microservicios — entorno local

Entorno para realizar las actividades con Docker y LocalStack en este Mac.
Los servicios emulados se ejecutan localmente, en `http://127.0.0.1:4566`, región `us-east-1`.
LocalStack **2026.10.6** está activado. Las pruebas reales de S3, SQS y DynamoDB
se completaron correctamente el 7 de noviembre de 2026.

## Comandos

Desde esta carpeta:

```bash
./scripts/entorno iniciar
./scripts/entorno estado
./scripts/entorno verificar
./scripts/awslocal s3 ls
./scripts/awslocal sqs list-queues
./scripts/entorno logs
./scripts/entorno detener
```

`detener` conserva el contenedor y el volumen. La conservación del estado de los servicios
entre reinicios requiere la función de persistencia; está desactivada por defecto para
usar el plan Hobby. El entorno usa el contexto `orbstack` explícitamente.
El comando local `scripts/awslocal` utiliza el AWS CLI ya instalado y credenciales ficticias
`test`/`test`. Fija el endpoint de LocalStack y evita leer los perfiles personales de AWS.
No es necesario instalar otro AWS CLI ni modificar la configuración global.

## Activación

Se descargó LocalStack **2026.10.6** para ARM64 y se fijó la imagen por su digest en Compose.
El token ya está configurado en `.env`. Los pasos siguientes sirven para una instalación
nueva o para reemplazarlo:

1. Crea tu cuenta en https://app.localstack.cloud/sign-up?plan=free y completa la verificación que solicite.
2. Revisa la licencia disponible en tu cuenta y su cobertura para AWS.
3. En la sección **Auth Tokens**, copia tu token.
4. Ejecuta `./scripts/configurar-token` en tu Terminal y pégalo en la entrada oculta.
5. Ejecuta `./scripts/entorno iniciar` y luego `./scripts/entorno verificar`.

El token se guarda en `.env`, con permisos `600` y excluido de Git. No lo pegues en el chat
ni lo incluyas en capturas o reportes. También puedes configurar `.env` manualmente
tomando `.env.example` como referencia.

## Datos, red y evidencias

- Proyecto Compose: `taller-microservicios-aws`.
- Contenedor: `taller-aws-localstack`.
- Red para contenedores del taller: `taller-microservicios-aws`.
- Los puertos publicados están vinculados a `127.0.0.1`.
- Hay un volumen Docker propio del proyecto. La persistencia del estado entre reinicios
  está desactivada por defecto porque no está incluida en Hobby. Si tu licencia la incluye,
  puedes activar `LOCALSTACK_PERSISTENCE=1` en `.env` y comprobarla antes de depender de ella.
- El socket de Docker permite que LocalStack levante contenedores para Lambda cuando una actividad lo requiera.
- La verificación prueba S3, SQS y DynamoDB, elimina los recursos temporales que crea y guarda
  el resultado real en `evidencias/00-entorno/verificacion.json`.
- La comprobación de salud utiliza Python, que está disponible dentro de la imagen fijada.
- La persistencia, Lambda y otros servicios se comprobarán según los requisitos de las actividades.
- Crea una carpeta en `actividades/` y otra en `evidencias/` para cada actividad.

Las pruebas de preparación no sustituyen las evidencias de las actividades del profesor.

## Documentación oficial consultada

- https://docs.localstack.cloud/aws/getting-started/installation/
- https://docs.localstack.cloud/aws/getting-started/auth-token/
- https://www.localstack.cloud/pricing
