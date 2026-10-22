# Backend NestJS en Vercel y PostgreSQL

El proyecto Vercel `intranet-arm-api` fue creado en `pdencinas-projects` y la
carpeta `backend` está vinculada por CLI. El frontend existente es `intranet_arm`.
El proyecto API todavía necesita variables, despliegue y verificación pública.

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
| `STORAGE` | `gcs` mientras se conservan los archivos existentes |
| `GCS_PROJECT_ID` | Proyecto que contiene los buckets utilizados |
| `GCS_BUCKET_DOCUMENTS` | Bucket privado de documentos existente |
| `GCS_BUCKET_AVATARS` | Bucket existente de imágenes |
| `GCS_CREDENTIALS_JSON` | Credencial del almacenamiento guardada como Secret en Vercel; nunca en Git |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Solo para mantener Google OAuth; registrar el callback nuevo |

Callback OAuth: `<BACKEND_URL>/api/v1/auth/google/callback`.
En el frontend: `NEXT_PUBLIC_API_URL=<BACKEND_URL>/api/v1`, seguido de redeploy.
Nunca poner DATABASE_URL, JWT_SECRET ni credenciales GCS en variables NEXT_PUBLIC.

Conservar GCS para archivos no utiliza Firestore. El traslado de los objetos a
Supabase Storage sigue pendiente; los enlaces existentes se conservan. El disco
local no es almacenamiento persistente en Vercel y el backend rechaza STORAGE=local
en ese entorno. Las peticiones de Vercel tienen límite de 4,5 MB: los límites
actuales de upload de 5/10 MB requieren una futura carga directa para esos tamaños.

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
