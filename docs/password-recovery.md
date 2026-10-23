# Acceso y recuperación con Resend

El sistema mantiene la identidad NestJS en `arm_app.users`; no usa Supabase Auth.

## Producción

Proyecto Vercel: `intranet_arm`. Variables exclusivas del servidor:

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | Clave Resend con permiso de envío, guardada en Vercel. |
| `RESEND_FROM_EMAIL` | `Ecosistema ARM <acceso@armglobal.org>` |
| `FRONTEND_URL` | `https://ecosistema.armglobal.org` (un único origen HTTPS, sin rutas). |

El dominio del remitente debe estar verificado en Resend. No activar seguimiento de clics para estos correos transaccionales: el enlace contiene un token de recuperación. Las variables no deben llevar `NEXT_PUBLIC_`. Preview necesita sus propias variables y destinatarios de prueba; no se copian secretos automáticamente desde Production.

Antes de desplegar, aplicar `backend/scripts/supabase-migration/sql/password-recovery.sql`. La tabla tiene RLS y acceso exclusivo del rol de servidor `arm_api`. La migración se aplicó en el proyecto Supabase `kqqufmijfvrgzrfrqsby` como `password_recovery_resend`.

## Comportamiento

- `/auth/login`: interfaz clara y enlace a recuperación.
- `/auth/forgot-password`: respuesta neutral para cuentas inexistentes, suspendidas o limitadas. Solo envía a cuentas `active` o `pending`; nunca cambia su estado ni sus permisos.
- `/auth/reset-password#token=…`: token aleatorio de 256 bits, almacenado únicamente como SHA-256. Vence en 15 minutos. El fragmento evita exponerlo en URLs de solicitudes HTTP o encabezados Referer.
- Una solicitud por cuenta por minuto y cinco por hora, con bloqueo en PostgreSQL compartido entre instancias Vercel. Los enlaces anteriores siguen siendo válidos hasta el cambio de contraseña o su vencimiento, para evitar que un tercero bloquee al dueño repitiendo solicitudes.
- El cambio consume el token de forma transaccional, invalida otros enlaces y refresh tokens, e incrementa `authVersion`. JWT anteriores dejan de ser válidos, incluidos los de simulación de roles. Login, refresh y recuperación bloquean primero la fila del usuario para evitar carreras.
- Los cambios de contraseña o correo desde perfil/administración también invalidan sesiones y enlaces previos.
- Contraseña recuperada: al menos 12 caracteres, máximo 72 bytes UTF-8 (límite de bcrypt). No se inicia sesión automáticamente.
- Una cuenta antigua sin contraseña debe verificar el correo mediante recuperación; el registro público ya no permite apropiarse de esa cuenta.
- Los errores de Resend se registran sin claves, direcciones ni enlaces. El endpoint mantiene una respuesta neutral para no revelar cuentas; revisar los registros de Vercel/Resend ante fallos de entrega.

## Verificación

Desde `backend`: `npm test`, `npx tsc -p tsconfig.build.json`, `node scripts/test-postgres-identity.cjs` y `node scripts/test-password-recovery.cjs`.

La prueba de recuperación utiliza `.env.runtime.local` antes de `.env.supabase`, un correo ficticio, un mailer simulado y rollback obligatorio. Comprueba hashes, límites, reutilización, expiración, contraseña anterior, revocación de JWT/refresh, cuentas antiguas y cambios de correo. No manda correos ni cambia usuarios reales. Las secuencias PostgreSQL pueden avanzar aunque haya rollback.

Desde `frontend`: `npm test` y `npm run build`. Para verificar entrega real, solicitar recuperación desde una cuenta propia autorizada, comprobar el correo en Resend y completar personalmente el enlace. La aceptación de Resend no garantiza recepción en la bandeja principal.
