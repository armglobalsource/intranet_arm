# Google Workspace: conexión del módulo Correos y accesos

## Alcance actual

La conexión de Production ya fue verificada contra Google. La automatización permite a TI ejecutar **altas de cuentas principales de armglobal.org**, agregar los grupos seleccionados como miembro, enviar por Resend un enlace de activación y comprobar buzón/MFA antes de cerrar. Las bajas suspenden la cuenta y requieren revisión final de TI. AR School Global no está configurado en esta organización: los alias entre ambos dominios y los cambios de cuentas existentes continúan con gestión directa de TI.

La ejecución permanece apagada hasta configurar `GOOGLE_WORKSPACE_AUTOMATION_ENABLED=true` exclusivamente en Production. La variable de conexión `GOOGLE_WORKSPACE_ENABLED` debe seguir activa. No habilitar en Preview ni desarrollo.

## Infraestructura autorizada el 6 de noviembre de 2026

- Proyecto Google Cloud: `skilled-box-513911-h1` (Ecosistema ARM Correos), número `950009830479`. Sin vincular facturación.
- Cuenta de servicio: `ecosistema-correos@skilled-box-513911-h1.iam.gserviceaccount.com`.
- Cliente OAuth de delegación: `118441732368885958075`.
- Administrador delegado: `contacto@armglobal.org`.
- Delegación registrada: `admin.directory.user`, `admin.directory.group.readonly`, `admin.directory.group.member` bajo `https://www.googleapis.com/auth/`.
- Pool: `vercel-production`; proveedor: `vercel`.
- Emisor: `https://oidc.vercel.com/pdencinas-projects`.
- Audiencia permitida: `https://vercel.com/pdencinas-projects`.
- Mapeo: `google.subject = assertion.sub`.
- Condición: equipo `team_K3yQaF6ahKgSAF0qRvdWrrqm`, proyecto `prj_LSHSJCUwqMX6sLsGR8KxbPKwjH3H`, entorno `production` y subject `owner:pdencinas-projects:project:intranet_arm:environment:production` deben coincidir simultáneamente.
- Rol personalizado `projects/skilled-box-513911-h1/roles/ecosistemaWorkspaceJwtSigner`: contiene exclusivamente `iam.serviceAccounts.signJwt`.
- Ese rol se concedió **sobre la cuenta de servicio**, no sobre todo el proyecto, al principal `principal://iam.googleapis.com/projects/950009830479/locations/global/workloadIdentityPools/vercel-production/subject/owner:pdencinas-projects:project:intranet_arm:environment:production`.

No se generó una clave privada. Cambiar de proyecto, equipo, administrador o dominio requiere revisar esta autorización y `WORKSPACE_IDENTITY` en el backend. El scope de usuarios permite operaciones amplias, incluida eliminación; el módulo no implementa eliminación y las futuras bajas deberán suspender cuentas. La delegación no concede lectura de mensajes de Gmail ni archivos de Drive.

## Habilitación y verificación

1. Confirmar habilitadas Admin SDK, IAM Service Account Credentials y Security Token Service en el proyecto dedicado.
2. Publicar backend y frontend del mismo commit en `intranet_arm`.
3. Guardar `GOOGLE_WORKSPACE_ENABLED=true` **solo en Production**, como variable del servidor, y desplegar. `VERCEL_ENV` y el token OIDC los proporciona Vercel. No crear una variable `NEXT_PUBLIC_` ni copiar tokens.
4. Un operador con `institutional-mail:manage` abre Gestión TI y pulsa **Comprobar conexión**. Solo una respuesta real correcta confirma el acceso; guardar variables o permisos no prueba conectividad.
5. La prueba intercambia el token de Vercel por uno federado, solicita a Google una firma de JWT con vigencia de cinco minutos, obtiene un token delegado y consulta un único identificador de usuario y grupo. Descarta esos datos; devuelve únicamente dominio y fecha de comprobación. No modifica el inventario ni solicitudes.

Endpoints protegidos por sesión, estado de cuenta y permiso de TI:

- `GET /api/v1/institutional-mail/workspace`: disponibilidad de configuración, sin afirmar conexión verificada.
- `POST /api/v1/institutional-mail/workspace/check`: comprobación contra Google.

Deshabilitar con `GOOGLE_WORKSPACE_ENABLED=false` y desplegar. Para revocar externamente, retirar el rol del principal de Vercel o deshabilitar el proveedor; para revocar Workspace, retirar la delegación del cliente OAuth. No eliminar el proyecto como procedimiento de apagado.

## Licencias y operación (7 de noviembre de 2026)

La consola muestra Google Workspace para Organizaciones sin Ánimo de Lucro, edición gratuita, 175 licencias asignadas y 125 disponibles. La asignación automática predeterminada está activada; existe una excepción de unidad organizativa. El módulo crea en la unidad raíz, no cambia políticas ni compra o asigna licencias por la API de licenciamiento. TI debe confirmar disponibilidad antes de cada ejecución. El cierre verifica que el buzón esté configurado, además de MFA inscrito y obligatorio.

Darwin Vargas (`dvargas@armglobal.org`) tiene el rol **Administrador de correos**, con `institutional-mail:manage` y sus permisos básicos previos. No recibe `institutional-mail:approve` ni permisos globales. El aprobador sigue siendo exclusivamente `pburgos@armglobal.org`; la cuenta ya está activa con el rol Aprobador de correos, verificado el 7 de noviembre de 2026.

## Recuperación y seguridad

- `mail_workspace_jobs` conserva el plan de ejecución antes de llamar a Google. La solicitud y su responsable TI deben estar vigentes; los reintentos usan el plan original.
- Una marca `externalIds` vincula la cuenta Google con la solicitud. Después de un timeout se reutiliza solo esa cuenta, nunca una cuenta ajena ni su contraseña. Los grupos ya aplicados se conservan.
- Los cambios de estado manuales se bloquean una vez preparada la ejecución; el cierre pasa por verificación de Google. No eliminar un trabajo para resolver un fallo: primero conciliar el estado real.
- Las cuentas de administradores, `contacto@armglobal.org` y `pburgos@armglobal.org` se excluyen de las mutaciones automáticas.
- El destinatario de entrega está en la solicitud aprobada. TI no puede sustituirlo al enviar el enlace.
- Contraseña inicial aleatoria descartada; activación por enlace de 24 horas en fragmento de URL. Solo se guarda el hash del token. Se consume antes del cambio en Google, incluso si la respuesta es ambigua. TI puede enviar uno nuevo; nunca reutilizar uno consumido.
- La contraseña elegida no se guarda en Supabase, eventos, notas ni correos. Google exige cambio inicial al iniciar sesión. El cierre exige `isMailboxSetup`, `isEnrolledIn2Sv` e `isEnforcedIn2Sv`.
- Las bajas solo suspenden; no borran usuarios ni transfieren Drive. TI revisa sesiones, accesos, archivos y licencia antes de cerrar. Las cuentas temporales mantienen su revisión siete días antes del vencimiento; no se suspenden automáticamente por fecha.
- RLS y privilegios del trabajo: solo `arm_api` tiene SELECT/INSERT/UPDATE; `anon` y `authenticated` no tienen acceso. No se devuelve el token ni su hash a la interfaz.

## Validación pendiente en producción

- Aprobador confirmado: cuenta activa y permiso exclusivo de aprobación.
- Publicar el código, habilitar la variable de automatización y comprobar el selector real de grupos.
- Probar un alta, entrega, MFA y suspensión con una cuenta expresamente autorizada. Las pruebas locales usan Google y Resend simulados; no sustituyen esa prueba real.

Referencias: [Vercel OIDC con Google Cloud](https://vercel.com/docs/oidc/gcp), [firma de JWT en Google](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signJwt).
