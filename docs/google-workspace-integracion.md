# Google Workspace: conexión del módulo Correos y accesos

## Alcance actual

La integración añade una comprobación real de conexión, accesible únicamente a TI desde **Gestión TI → Google Workspace → Comprobar conexión**. No crea usuarios, no cambia contraseñas, no entrega accesos ni asigna licencias. La operación de solicitudes sigue siendo manual hasta implementar y validar esas acciones. AR School Global no está configurado en esta organización; no se debe ejecutar automáticamente el alias entre ambos dominios.

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

## Pendiente antes de automatizar altas y bajas

- Comprobar en Production la autenticación real y resolver cualquier error de configuración.
- Confirmar usuario activo del aprobador `pburgos@armglobal.org` y permiso; identificar y habilitar a Darwin como TI.
- Definir licencias disponibles y su asignación, destinatario personal verificado y entrega segura del acceso inicial.
- Implementar acciones idempotentes vinculadas a una solicitud aprobada y al responsable de TI, con registro de resultados y recuperación ante fallos parciales.
- Verificar MFA según la política de Workspace; no marcar enrolamiento completo por crear una cuenta.
- Probar altas, alias, grupos y suspensión con una cuenta de prueba expresamente autorizada.

Referencias: [Vercel OIDC con Google Cloud](https://vercel.com/docs/oidc/gcp), [firma de JWT en Google](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signJwt).
