# Correos y accesos · Guía operativa

## Quién hace cada paso

- **Solicitante:** ingresa al Ecosistema, abre Correos y accesos y crea una solicitud. Solo consulta sus solicitudes y corrige las que recibe con observaciones.
- **Aprobador:** exclusivamente el Pastor con la cuenta `pburgos@armglobal.org`. Revisa la identidad, empresa, cargo, accesos y destinatario del enlace. Puede aprobar, observar o rechazar. No puede aprobar una solicitud propia.
- **TI:** Darwin (`dvargas@armglobal.org`), con el rol Administrador de correos. Ve Gestión TI, solicitudes, historial, inventario y revisiones de cuentas temporales. No puede aprobar en nombre del Pastor ni administrar otros módulos con este rol.

## Solicitar un correo

1. Entra al Ecosistema y abre **Correos y accesos → Nueva solicitud**.
2. Selecciona la empresa. El dominio se asigna automáticamente: ARM Global usa `armglobal.org`; AR School Global usa `arschoolglobal.com`.
3. Completa nombre y apellido, RUT/ID, área, cargo, fecha de ingreso, tipo de cuenta, nombre sugerido y grupos necesarios.
4. Para una cuenta nueva indica un **correo de contacto que el destinatario ya pueda abrir**. Para una cuenta funcional se usa el del responsable titular. Allí llegará el enlace de activación; no se envía al buzón que todavía no existe.
5. Envía la solicitud. Queda en aprobación. Si hay observaciones, corrígela y reenvíala; se requiere una nueva aprobación.

Nunca escribas contraseñas, códigos MFA ni enlaces de activación en las notas.

## Revisión del Pastor

En **Aprobaciones**, revisa los datos y especialmente el correo de contacto y los grupos solicitados. Usa **Aprobar y enviar a TI**, **Solicitar corrección** o **Rechazar solicitud**. Observar o rechazar requiere un motivo.

## Crear una cuenta desde TI

Disponible para cuentas principales de ARM Global cuando la automatización esté habilitada en Production. AR School Global, alias entre dominios y cambios de cuentas existentes mantienen el proceso manual de TI.

1. Entra a **Gestión TI** y abre una solicitud aprobada.
2. Revisa identidad, cuentas existentes y disponibilidad de licencia. Si ya existe una cuenta principal para esa persona, no crees otra: evalúa un alias o cambio de accesos.
3. Confirma la revisión y pulsa **Tomar solicitud e iniciar**. La ejecución y el cierre quedan a cargo del operador que tomó la solicitud.
4. En **Crear y entregar el correo**, revisa la dirección final y selecciona los grupos reales de Google. El texto escrito por el solicitante no asigna permisos automáticamente. Sin grupos seleccionados no se agrega ninguno.
5. Confirma identidad y licencia. Pulsa **Revisar y ejecutar** y luego confirma la dirección que se creará.
6. Cuando Google confirme la creación, pulsa **Enviar enlace de activación**. El sistema envía el enlace al correo de contacto aprobado.
7. El destinatario define una contraseña inicial, ingresa a Google, realiza el cambio inicial y completa la verificación en dos pasos.
8. Pulsa **Verificar buzón y MFA para cerrar**. Solo se cierra si el acceso se activó, el buzón existe y Google confirma MFA inscrito y obligatorio. Si falta algo, la solicitud continúa pendiente.

El plan verificado el 7 de noviembre de 2026 es Google Workspace para organizaciones sin fines de lucro, gratuito, con asignación automática predeterminada. La disponibilidad cambia: TI debe revisarla antes de cada alta. El módulo no compra licencias ni modifica esa política.

## Si ocurre un error

- **La creación no terminó:** vuelve a la misma solicitud y usa Reanudar ejecución. El sistema concilia la cuenta creada por esa solicitud y los grupos ya aplicados. No abras otra solicitud para repetir la misma alta.
- **El correo ya existe:** revisa la identidad y el inventario. Nunca reutilices una cuenta ajena ni la conviertas en una cuenta nueva.
- **No llegó el enlace:** verifica el correo de contacto y spam. TI puede enviar otro después de un minuto; el anterior queda invalidado. Si el destinatario está mal, no improvises un correo distinto: requiere revisión del caso.
- **Enlace vencido, consumido o activación sin confirmar:** solicita a TI otro enlace. Cada enlace dura 24 horas y admite un solo intento de activación.
- **Falta MFA:** el destinatario debe inscribirse y la política de Google debe exigirlo. TI revisa esa configuración en Google Admin; el módulo no cambia políticas globales.
- **Operación ya preparada:** no rechaces ni edites sus datos para intentar borrar lo ocurrido en Google. Reanuda o concilia con el administrador; el historial debe conservarse.

## Bajas y cuentas temporales

Una baja también requiere aprobación. TI toma la solicitud y, desde la fecha efectiva, confirma la suspensión. La automatización **suspende, no elimina**: conserva la cuenta y sus datos. Antes de cerrar, TI revisa sesiones, accesos, archivos, alias y licencia y deja constancia del resultado.

Las cuentas temporales aparecen en revisiones pendientes desde siete días antes del vencimiento. No se suspenden por fecha sin intervención: TI debe gestionar su continuidad o baja.

## Estado de puesta en marcha

- Conexión OIDC con Google: verificada anteriormente en Production.
- Licencias: revisadas; rol limitado de Darwin: configurado.
- Tabla privada de seguimiento y activación: aplicada y acceso verificado.
- Código de automatización: preparado; publicación y habilitación pendientes.
- Aprobador: `pburgos@armglobal.org` activo con el rol Aprobador de correos.
- Prueba completa con cuenta real: pendiente de una solicitud y destinatario autorizados.

No anunciar el flujo como operativo hasta completar la publicación, habilitación y prueba real.
