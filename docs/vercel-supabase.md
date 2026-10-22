# Backend NestJS en Vercel y PostgreSQL

El proyecto Vercel `intranet-arm-api` fue creado en `pdencinas-projects` y la
carpeta `backend` está vinculada por CLI. El frontend existente es `intranet_arm`.
El proyecto API todavía necesita DATABASE_URL del rol limitado, SUPABASE_SECRET_KEY,
BACKEND_URL definitivo, despliegue y verificación pública. Ya se configuraron en
Production y Preview STORAGE=supabase, SUPABASE_URL, SUPABASE_BUCKET_PUBLIC,
SUPABASE_BUCKET_DOCUMENTS, FRONTEND_URL y un JWT_SECRET nuevo, sin exponer su valor.

## Avance de preparación (21 de octubre de 2026)

- StorageService admite Supabase Storage. Documentos usan bucket privado y enlaces
  firmados; las imágenes públicas usan un bucket separado. Los buckets aún no se
  crearon y falta la clave del servidor para verificar subidas reales.
- SDK fijado a @supabase/supabase-js 2.118.0. TypeScript y 29 pruebas aprobadas.
- Respaldo de 26 objetos de Google Cloud (6.786.174 bytes) guardado exclusivamente
  en migration-artifacts, ignorado por Git. Ningún archivo fue borrado del origen.
- Inventario SQL: 15 URLs distintas al bucket intranet-arm.firebasestorage.app.
  Antes de hacer público un objeto en destino, comprobar su acceso público en
  origen. Los objetos no referenciados no deben hacerse públicos automáticamente.
- Nueva exportación de 1.406 documentos conciliada con la original: solo cambió
  lastLoginAt de un usuario, un contador y tokens de sesión. No es un corte final:
  el origen sigue recibiendo escrituras y hay que conciliar de nuevo antes del cambio.
- Los workflows antiguos de GitHub pasan a ejecución manual; no desplegarán
  automáticamente en Google Cloud después de publicar este cambio.
- El panel Supabase requiere completar MFA; sigue pendiente autorización explícita
  del rol SQL rechazada por la revisión automática anterior.
- Sigue pendiente adaptar las subidas de 5/10 MB al límite HTTP de Vercel antes
  del corte. La nueva integración de Storage por sí sola no elimina ese límite.

Herramientas de traslado: inventory-storage.cjs (solo lectura), copy-storage.cjs
(copia sin sobrescribir, verifica SHA-256 del destino) y compare-exports.cjs.
Nunca incluir sus respaldos, URLs firmadas o credenciales en Git.

La migración `arm_backend_runtime_role` NO se aplicó: la revisión automática
rechazó el rol `arm_api` con CRUD y políticas de acceso a todas las tablas privadas
`arm_app`. El SQL propuesto queda en `backend/scripts/supabase-migration/sql/backend-role.sql`
para revisión. No otorga acceso a `arm_migration`, `anon` o `authenticated`, pero
permite al servidor trabajar con todos los usuarios; la autorización de cada
solicitud corresponde a los guards y servicios de NestJS. Se requiere resolver
esa autorización antes de configurar las credenciales del despliegue.

El arranque normal `src/main.ts` importa ahora exclusivamente el módulo PostgreSQL.
Antes de escuchar verifica las 32 tablas requeridas. El módulo anterior queda
en `legacy-app.module.ts` para referencia; no se usa ni se selecciona como fallback.
Las clases antiguas aún sirven como tokens de inyección para reutilizar los
controladores. No se instancia FirebaseService en la aplicación PostgreSQL.

## Configuración

Vercel admite NestJS directamente, detectando `src/main.ts`. Crear/configurar la
API como proyecto independiente con raíz `backend`, framework NestJS. No cambiar
la raíz del proyecto frontend, que sigue siendo `frontend`.

Variables de la API, exclusivamente del servidor:

| Variable | Valor o procedencia |
| --- | --- |
| `DATABASE_URL` | Supabase Connect, Transaction pooler, puerto 6543; rol limitado para la aplicación |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `FRONTEND_URL` | `https://intranetarm.vercel.app` y otros orígenes autorizados, separados por coma |
| `BACKEND_URL` | URL estable del nuevo proyecto API |
| `NODE_ENV` | `production` |
| `STORAGE` | `supabase` |
| `SUPABASE_URL` | URL del proyecto ecosistema_arm |
| `SUPABASE_SECRET_KEY` | Clave secreta exclusivamente del servidor |
| `SUPABASE_BUCKET_PUBLIC` | `arm-public`, imágenes destinadas a acceso público |
| `SUPABASE_BUCKET_DOCUMENTS` | `arm-documents`, documentos privados |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Solo para mantener Google OAuth; registrar el callback nuevo |

Callback OAuth: `<BACKEND_URL>/api/v1/auth/google/callback`.
En el frontend: `NEXT_PUBLIC_API_URL=<BACKEND_URL>/api/v1`, seguido de redeploy.
Nunca poner DATABASE_URL, JWT_SECRET ni credenciales GCS en variables NEXT_PUBLIC.

El traslado de los objetos a Supabase Storage sigue pendiente; los enlaces
existentes se conservan hasta verificar cada copia. El disco local no es
almacenamiento persistente en Vercel y el backend rechaza STORAGE=local en ese
entorno. Las peticiones de Vercel tienen límite de 4,5 MB: los límites actuales
de upload de 5/10 MB requieren carga directa para esos tamaños antes del corte.

## Verificación y corte

26 pruebas unitarias aprobadas; TypeScript sin errores. Integraciones reales con
rollback aprobadas para identidad/HTTP, fichas e historial y los restantes dominios,
incluidos registros ARM, estadísticas, eventos, roster y conciliación.
Los tests de subida usan almacenamiento simulado: no verifican permisos reales GCS.
Google OAuth tampoco se verificó contra el proveedor externo.

Las 32 tablas `arm_app` están creadas. Los registros ARM nuevos usan JSONB para los
datos anidados con columnas generadas e índices de campus, fecha, usuario y claves
de reintento por usuario; las relaciones de campus son claves foráneas.

Antes de cambiar el tráfico: configurar rol SQL limitado y secretos, desplegar la
API en Preview, probar salud/login/rutas y almacenamiento, conciliar una exportación
final con las escrituras del origen detenidas y actualizar el frontend. La copia
de Supabase actual es un ensayo; producción Cloud Run continúa en Firestore.
No apagar ni borrar el origen hasta confirmar el corte y su respaldo.

El backend Cloud Run observado es `intranet-backend`, región `us-central1`:
https://intranet-backend-668104619654.us-central1.run.app.

Referencias verificadas:
- https://vercel.com/docs/frameworks/backend/nestjs
- https://vercel.com/docs/functions/limitations
- https://supabase.com/docs/guides/database/postgres/roles
