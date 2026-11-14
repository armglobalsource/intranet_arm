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

Conservar los identificadores de tipos de entrada al introducir inscripciones/órdenes: la fase 2 reemplaza esas filas en cada guardado porque todavía no tienen referencias. Introducir versionado de formularios, reservas transaccionales y la apertura efectiva de inscripciones de forma conjunta. Agregar personal de acreditación y sus permisos únicamente cuando exista el flujo de tickets.
