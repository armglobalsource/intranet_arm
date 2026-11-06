# Correos y accesos — guía de operación

El módulo está en **Servicios internos → Correos y accesos** (`/dashboard/correos`). Funciona dentro del mismo repositorio y despliegue del ecosistema. No necesita Asana, una nueva API key ni una integración con Google para gestionar solicitudes.

## Habilitación inicial

1. Desplegar frontend y backend del mismo commit. La migración `20261105205456_institutional_mail_workflow.sql` debe estar aplicada antes del despliegue.
2. En la configuración de roles, asignar `institutional-mail:approve` al rol del aprobador designado, pburgos@armglobal.org.
3. Asignar **Gestionar solicitudes e inventario (TI)** (`institutional-mail:manage`) al equipo que administra Google Workspace. Los administradores con `*` pueden gestionar TI, pero solo la cuenta activa pburgos@armglobal.org con permiso puede aprobar.
4. Las solicitudes se asignan automáticamente a pburgos@armglobal.org, quien debe tener una cuenta activa y el permiso de aprobación. No se permite la autoaprobación. TI puede gestionar todas las solicitudes.
5. Confirmar con TI si `armglobal.org` y `arschoolglobal.com` permiten alias dentro de la misma organización de Google Workspace. Esa comprobación es obligatoria para ejecutar un alias entre dominios.

Todos los usuarios activos pueden presentar solicitudes y consultar las propias. Una cuenta pendiente de aprobación en el ecosistema no puede entrar a este flujo.

## Solicitar un correo

1. Pulsar **Nueva solicitud** y seleccionar **Solicitud de correo**.
2. Indicar empresa, tipo de cuenta y el aprobador asignado. El dominio se asigna automáticamente: ARMGLOBAL → `armglobal.org`; AR School Global → `arschoolglobal.com`.
3. Completar nombre y apellido, RUT/ID de colaborador, área, cargo y fecha de ingreso. Usar siempre el mismo identificador para una misma persona.
4. Indicar el nombre sugerido, sin `@dominio`, y los grupos o accesos. Si no requiere grupos, escribir «Ninguno».
5. Para una cuenta temporal, indicar vencimiento. Para una cuenta funcional, indicar responsable titular y justificación.
6. Enviar a aprobación. El solicitante puede ver el estado y el historial en **Mis solicitudes**.

La convención es `nombre.apellido`. TI confirma que esté disponible; ante coincidencias, utiliza `nombre.apellido2`, `nombre.apellido3`, etc. No se reserva una dirección solo por enviar la solicitud.

## Aprobar como responsable designado

En **Aprobaciones**, abrir la solicitud asignada y comprobar identidad, cargo, empresa y accesos:

- **Aprobar y enviar a TI** habilita la validación técnica.
- **Solicitar corrección** requiere explicar qué debe cambiar. El solicitante puede corregir y reenviar; se requiere una nueva aprobación.
- **Rechazar solicitud** requiere motivo y cierra el flujo.

No se permite la autoaprobación. No hace falta dar acceso de TI al aprobador para que apruebe sus solicitudes.

## Operar como TI

1. Abrir **Gestión TI** y filtrar **Validación TI**.
2. Revisar en Google Workspace la identidad, el dominio, la disponibilidad del nombre, las cuentas existentes, la licencia y los grupos. El inventario del ecosistema no sustituye esta comprobación.
3. Marcar la verificación y pulsar **Tomar solicitud e iniciar**. Queda registrado el responsable de TI.
4. Crear o modificar la cuenta manualmente en Google Workspace. Para un alias, conservar una sola cuenta principal y ninguna licencia adicional.
5. Configurar/verificar MFA obligatorio y entregar el acceso por un canal seguro. Exigir cambio de contraseña inicial cuando corresponda.
6. En el ecosistema, registrar correo final, licencia y grupos realmente aplicados. Confirmar las verificaciones y pulsar **Confirmar gestión realizada**.

Solo el operador que tomó la solicitud puede registrar su entrega. Otro operador de TI puede devolverla con observaciones para que se revise y asigne de nuevo si fuera necesario. La aprobación del responsable designado no crea automáticamente una cuenta.

Nunca guardar contraseñas, códigos MFA ni enlaces de activación en observaciones, notas o historial. La plataforma registra confirmaciones del operador; no activa MFA ni administra contraseñas en Google.

## Alias y cuentas existentes

Seleccionar **Alias · sin licencia adicional**, indicar la empresa del dominio de destino y el correo de la cuenta principal del otro dominio. TI debe confirmar que ambas direcciones corresponden a la misma persona y que la configuración de Workspace lo permite.

Si la cuenta principal ya existe en Workspace pero todavía no figura en el inventario, se registra como existente al completar el alias, después de la comprobación de TI. Si figura asociada a otra identidad, la operación se bloquea. No se admiten dos cuentas principales activas para el mismo ID de colaborador; las cuentas funcionales se administran por separado.

El inventario se construye a partir de las gestiones completadas aquí: **no es una importación automática de todas las cuentas de Workspace**.

## Cambios, renovación y baja

- Para cambiar correo o accesos, crear una solicitud **Cambio de correo / accesos**, indicar la cuenta existente y describir el cambio. En la entrega TI puede registrar la nueva dirección dentro del dominio aprobado. No se permite convertir un alias en cuenta principal mediante ese cambio.
- Para renovar una temporal, solicitar un cambio e indicar el nuevo vencimiento. No cambiar el ID de la persona.
- Para una salida, usar **Baja de colaborador**. Indicar fecha efectiva y tratamiento solicitado para accesos y archivos. TI completa la baja después de revocar accesos y verificar el tratamiento de datos y licencias; no se puede completarla antes de la fecha efectiva.
- La baja de una cuenta principal marca también sus alias como inactivos en el inventario. La baja de un alias deja activa la principal.

Desde **Cuentas institucionales**, TI puede abrir la última gestión o iniciar una solicitud de cambio/renovación o baja con los datos precargados. Cada una vuelve a pasar por aprobación.

## Revisiones por vencimiento

Las cuentas con vencimiento aparecen en **Revisiones por vencimiento** desde siete días antes de su fecha. También se muestran las vencidas mientras sigan activas. Al entrar al módulo, TI ve el número de revisiones pendientes.

Esta primera versión presenta la cola y el aviso dentro del módulo; no envía recordatorios programados por correo ni suspende cuentas automáticamente. TI debe revisar esta bandeja durante su operación diaria y tramitar renovación o baja. Un cambio de fecha aprobado actualiza la próxima revisión.

## Historial, avisos y privacidad

Cada envío, corrección, aprobación, observación, rechazo, inicio y entrega conserva actor y fecha. Las correcciones guardan la versión enviada; el backend no puede actualizar ni borrar los eventos del historial. Las transiciones generan notificaciones internas a los participantes correspondientes y a TI cuando toca revisar la cola. Las acciones concurrentes se rechazan si la versión ya cambió.

Las tres tablas viven en el esquema privado `arm_app`, con RLS y sin lectura directa para `anon` o `authenticated`. El backend aplica el acceso por solicitante, aprobador asignado y permiso de TI. No hay rutas públicas ni adjuntos de identificación.

## Validación técnica

- Backend: `node node_modules/vitest/vitest.mjs run src/institutional-mail/mail.spec.ts` desde `backend`.
- Interfaz: `node node_modules/@playwright/test/cli.js test e2e/institutional-mail.spec.ts --workers=1` desde `frontend`, con Next local en 3005. Las pruebas simulan la API y no crean cuentas ni envían correos.
- Las verificaciones de ejecución siguen siendo declaraciones registradas por el operador. La nueva comprobación de conectividad de Google Admin SDK consulta usuarios y grupos, sin ejecutar solicitudes. Ver [configuración y límites de la integración](google-workspace-integracion.md).
