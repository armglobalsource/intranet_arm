# ARM Global Eventos — diagnóstico y alcance

## Diagnóstico del repositorio (13 noviembre 2026)

1. **Arquitectura:** Next.js 14 App Router, React 18, TypeScript, Tailwind, React Query, Zustand y axios; API NestJS 10 con `pg`, integrada al despliegue Vercel. No se añade aplicación ni dependencias de runtime.
2. **Identidad:** JWT propio de Nest, revocación y estado de usuario consultados por solicitud. Reutilizar `CurrentUser`, guardias globales y catálogo de permisos. No utilizar una segunda autenticación Supabase.
3. **Campus:** `arm_app.campuses`, identificadores bigint, país y estado activo; `users.campusId` define campus del usuario. Referenciar estas tablas, nunca duplicarlas.
4. **Persistencia:** `DatabaseService` proporciona consultas parametrizadas y transacciones. `arm_app.events` ya alimenta el calendario anual mediante `ArmRecordStore` (document_id/data). Su contrato antiguo permite eliminación y categorías fijas: cambiarlo directamente afectaría el calendario. La administración ampliada utiliza `event_programs` y relaciones propias; el calendario operativo permanece intacto. La sincronización explícita con calendario se deja para una etapa posterior, evitando copias automáticas divergentes.
5. **UI reutilizable:** dashboard/layout y Sidebar, `usePermissions`, `apiErrorMessage`, React Query, logos públicos. No existe una biblioteca `components/ui`; usar CSS del módulo y controles accesibles coherentes con el sistema.
6. **Integraciones:** `ResendMailerService` disponible para fase 4. Storage y carga directa existentes tienen propósitos/permisos específicos; primera versión permite URL HTTPS de banner, sin ampliar permisos de cargas ajenas. No se encontró Mercado Pago en dependencias ni servicios.
7. **Archivos:** nuevo backend `event-management`; registro en `postgres-domain.providers.ts`; permisos en ambos catálogos; menú Sidebar; rutas dashboard/eventos y eventos/[slug]; API pública excluida de redirección al login.
8. **Tablas fase 2:** `event_categories`, `event_programs`, `event_program_campuses`, `event_ticket_types`, `event_audit_logs`. Reutilizan usuarios/campus. Detalles editoriales y FAQ en JSON validado, no HTML ejecutable. Categorías administrables; precio/moneda/cupos definidos por evento. No crear tablas vacías de pagos o participantes todavía.
9. **Compatibilidad y riesgos:** calendario anterior continúa separado; las tablas nuevas requieren migración antes del despliegue. Roles no reciben acceso por defecto salvo wildcard existente. Edición con versión y bloqueo transaccional evita sobreescrituras. Proyección pública explícita excluye responsables internos/auditoría. RLS permite solo backend `arm_api`; Nest impone autorización por registro.
10. **Fases:** 1 diagnóstico/integración; 2 CRUD, categorías, configuración, duplicación y publicación; 3 formularios versionados, cupos y participantes; 4 entradas gratuitas, QR y correos; 5 Mercado Pago sandbox y conciliación idempotente; 6 acreditación atómica y reportes.

## Contrato de permisos

- `eventos:manageAll`: todos los eventos y categorías.
- `eventos:manageCampus`: crear y gestionar eventos de su campus actual.
- `eventos:organize`: editar únicamente eventos donde fue designado organizador; no crear ni cambiar campus/responsable.
- `*` y `eventos:*` siguen las reglas existentes.
- La lectura administrativa exige alguno de esos permisos. Participar como campus invitado no concede edición.
- El responsable se selecciona entre usuarios activos; no se expone públicamente su correo.

## Alcance operativo de esta entrega

Publicación: borrador/publicado/finalizado/cancelado. Inscripción: pendiente/cerrada; la apertura se habilitará cuando exista el flujo transaccional de fase 3. Se pueden preparar fechas, cupos, espera, condiciones, edad y tipos de entrada, sin cobrar ni emitir tickets. La página pública informa que la inscripción todavía no está habilitada. Las métricas de esta etapa son solo eventos reales, sin cifras ficticias de participantes.

Duplicar genera borrador, slug nuevo, inscripciones pendientes y versión 1; no copia participantes ni historial. No hay eliminación destructiva: se cancela o vuelve a borrador. Banner y color configurables con logo corporativo existente.

## Entrega y activación

La migración se prepara localmente. **No aplicar en base compartida ni desplegar sin confirmación del propietario**, según el documento de requisitos. Revisar migración y permisos, aplicar primero en entorno de prueba, probar CRUD/publicación con cuentas de cada alcance y después autorizar producción. El backend no ejecuta migraciones al arrancar.

Referencias verificadas: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [changelog](https://supabase.com/changelog.md).

## Operación de la fase 2

1. Un administrador global entra en **Eventos → Categorías** y agrega el catálogo que utilizarán los campus.
2. En **Gestión de eventos → Crear evento**, completa nombre, enlace, campus, responsable y fechas. Las horas se introducen en la zona horaria del dispositivo, identificada en pantalla; la portada las presenta en la zona configurada del evento.
3. En **Identidad visual**, agrega resumen, descripción, banner HTTPS opcional, color y preguntas frecuentes. La vista previa funciona sin publicar ni enviar correos.
4. En **Participación**, prepara cupos, edad, fechas previstas, condiciones y entradas con sus monedas. Esta fase todavía no admite registros ni pagos.
5. En **Publicación**, elige Publicado y guarda. La URL pública es `/eventos/<enlace>`. Una vez publicada, esa URL queda estable incluso al volver a borrador. Solo los eventos publicados previamente pueden consultarse como cancelados o finalizados.
6. Duplicar crea un borrador con otro enlace; revisar fechas y configuración antes de publicar la copia. Para retirar temporalmente una portada, volver a Borrador. Para comunicar cancelación, elegir Cancelado (cierra inscripciones).
7. Los gestores de campus administran solamente su campus; el organizador asignado puede editar su evento, sin trasladarlo ni reasignarlo. La configuración de categorías corresponde al administrador global.

## Verificaciones realizadas (14 noviembre 2026)

- 21 pruebas backend: ámbitos de acceso, fechas/zonas horarias, precios, validación anidada real, publicación, conflicto de versión, creación transaccional con DB simulada, slug estable y exclusión pública de borradores.
- 7 pruebas Playwright con API simulada: editor y portada a 320/393/834/1440 px, sin desbordamiento; guardado/publicación; navegación de gestor y bloqueo de usuario sin permisos. Capturas revisadas visualmente.
- TypeScript backend y frontend, compilación de ambos y lint de los archivos nuevos: correctos. El build Next termina con código 0, pero Windows advierte EPERM al copiar el symlink standalone de `intranet-backend`; verificar empaquetado en Vercel antes de declarar producción operativa.
- No se ejecutó SQL contra una base local o compartida: no hay servidor PostgreSQL local disponible. La migración requiere validación SQL/integración en un entorno de prueba antes de su aplicación productiva. No se ha hecho push ni desplegado.
- Las pruebas no crean participantes, no envían mensajes, no generan tickets y no efectúan cobros.

## Antes de continuar con fase 3

## Aplicación autorizada en Supabase (14 noviembre 2026)

El propietario autorizó aplicar la migración y desplegar. La migración `event_programs_phase_two` se aplicó correctamente en `kqqufmijfvrgzrfrqsby`. Se verificaron las cinco tablas, RLS activo, acceso del backend y ausencia de lectura para `anon`/`authenticated`. El asesor de seguridad no reportó hallazgos en las tablas nuevas. No se crearon datos operativos ni categorías de ejemplo.

La comprobación DML con rollback no llegó a ejecutarse: venció la confirmación del conector. La conexión directa local tampoco estuvo disponible (DNS). Por tanto, no se presenta la prueba de escritura real como aprobada. Se mantienen las 28 pruebas anteriores con dependencias simuladas.

## Continuación de inscripciones

Las inscripciones conservan una copia del nombre de entrada, importe, moneda, condiciones y versión del evento. No dependen de las filas reemplazables del catálogo de entradas. Una entrada del catálogo que cambie mientras alguien completa el formulario se rechaza y debe seleccionarse nuevamente. El formulario de esta etapa es fijo; el constructor de campos personalizados y la acreditación QR quedan pendientes.

## Inscripciones y Mercado Pago Chile de prueba (16 noviembre 2026)

La migración `20261116154624_event_registrations.sql` se aplicó el 16 de noviembre de 2026 con autorización expresa del propietario. Se verificó RLS activo, acceso del backend y ausencia de lectura para `anon` y `authenticated`. El asesor no reportó hallazgos en la tabla nueva. El código se entrega mediante push; falta configurar credenciales y verificar el flujo completo de prueba antes de abrir inscripciones.

### Operación

1. Información: fechas y horas propias de cada evento; seleccionar campus participantes.
2. Participación: acceso gratuito o pagado. Gratuito oculta precios; pagado utiliza entradas CLP enteras y Mercado Pago exclusivamente de prueba. Definir capacidad, edad mínima, apertura/cierre opcionales y lista de espera.
3. Publicación: Publicado + Abiertas habilita el formulario solo dentro de las fechas configuradas. No se abren eventos sin campus o sin configuración segura del servidor.
4. Participante: datos personales → contacto/campus/entrada → condiciones y confirmación. En un evento gratuito se confirma inmediatamente si hay cupo; con cupo agotado se rechaza o se registra en espera según configuración.
5. Pagado: reserva máxima de 24 horas, acotada por el fin del evento y la fecha límite de pago. Solo la notificación firmada y la consulta al proveedor pueden confirmar el pago. Un retorno del navegador no confirma nada. Un pago tardío queda en revisión sin otorgar un cupo adicional. Pagos reembolsados/revertidos retiran la entrada y quedan en revisión.
6. Comprobante: enlace privado por correo y pantalla imprimible con código de inscripción. El participante puede actualizar estado y reintentar un correo fallido. El código todavía NO es un QR de acreditación; no se implementa check-in en esta etapa.
7. El editor muestra las últimas 500 inscripciones con nombre, correo, campus y estado, respetando permisos de evento/campus. La promoción desde espera y la resolución de pagos en revisión aún requieren desarrollo; no se promociona ni reembolsa automáticamente.

### Variables exclusivamente del servidor

- `EVENT_REGISTRATION_SECRET`: secreto aleatorio de al menos 32 caracteres. Mantener estable: rotarlo invalida los enlaces existentes.
- `EVENT_PAYMENTS_MODE=test`.
- `MERCADOPAGO_TEST_ACCESS_TOKEN`: credencial del **vendedor de prueba de Chile**. Antes de crear checkout se consulta `/users/me`: debe tener `site_id=MLC` y etiqueta `test_user`. Un vendedor real se rechaza.
- `MERCADOPAGO_WEBHOOK_SECRET`: firma secreta de notificaciones de esa aplicación.
- `FRONTEND_URL`: origen público HTTPS, sin rutas, por ejemplo `https://ecosistema.armglobal.org`.
- Reutiliza `RESEND_API_KEY` y `RESEND_FROM_EMAIL` existentes.

Configurar notificaciones `payment` hacia `/api/v1/event-payments/webhook`. La firma utiliza el `data.id` del query y los headers `x-request-id`/`x-signature`; se verifica por HMAC y comparación constante. El servidor consulta el pago y valida vendedor, `live_mode=false`, importe, moneda y referencia interna. El identificador del pago es único y sus repeticiones no vuelven a confirmar la inscripción. El checkout usa `init_point`; las credenciales y la verificación del vendedor determinan el entorno de prueba, no una URL sandbox.

Referencias oficiales: [Preferencias Checkout Pro](https://www.mercadopago.cl/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post), [firma de notificaciones](https://www.mercadopago.cl/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications), [guía técnica oficial de integración](https://github.com/mercadopago/mercadopago-claude-marketplace/blob/main/plugins/mercadopago/skills/mp-integrate/SKILL.md).

### Persistencia y límites

- Nueva tabla privada `arm_app.event_registrations`, RLS y privilegios únicamente para el backend; amplía el estado de inscripción con `open` sin cambiar estados actuales.
- Reserva serializada por bloqueo del evento. Email único por evento e idempotencia mediante clave aleatoria de 256 bits (solo hash almacenado).
- El acceso privado usa HMAC por inscripción y se transmite en el fragmento de URL/cuerpo POST, nunca como parámetro de consulta.
- Los correos se intentan después de confirmar la transacción. El fallo queda visible y permite reintento; todavía no existe una cola automática de reintentos.
- La capacidad no puede reducirse por debajo de los cupos confirmados/reservados. Las reservas vencidas dejan de ocupar cupo. Para reinscribir un correo cuya reserva venció se requiere implementar la gestión administrativa; no se sobreescribe el historial.
- Pendiente antes de uso real: aplicar y verificar migración, configurar secretos, prueba completa con vendedor/comprador de prueba y webhook accesible. No se han creado participantes, enviado correos ni efectuado pagos reales durante las pruebas locales.

### Validación local de esta etapa

- 35 pruebas de backend aprobadas: alcance, fechas, DTO, cupos/espera, reintentos, correo fallido, claves privadas, firma, bloqueo de vendedor real/pago live, importe, pago pendiente, confirmación repetida y pago tardío. Base de datos y proveedores simulados: no sustituye la prueba transaccional real después de aplicar la migración.
- 9 escenarios de navegador aprobados: los 7 existentes de editor/portada/permisos y 2 inscripciones completas a 393 px (gratis y pagada). Se corrigieron etiquetas accesibles de edad/campus/entrada y se revisó la captura móvil.
- Compilación TypeScript backend correcta. Build Next compila y genera las páginas; persiste el aviso EPERM de Windows al copiar el symlink de backend en standalone, ya presente en la etapa anterior. Comprobar el despliegue Linux de Vercel antes de darlo por operativo.
