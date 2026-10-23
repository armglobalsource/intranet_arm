# Backend NestJS en Vercel y PostgreSQL

## Sin Firebase ni Google Cloud (23 de octubre de 2026)

- El código ya no depende de Firebase ni de Google Cloud. Se eliminaron los 30
  servicios Firestore usados como tokens de inyección: los controladores reciben
  directamente sus servicios PostgreSQL. También FirebaseService, los módulos
  antiguos, `legacy-app.module.ts`, la rama GCS de StorageService (queda
  `supabase` o `local`) y las dependencias `firebase-admin`,
  `@google-cloud/storage` y `passport-google-oauth20`.
- Al tipar los controladores con los servicios reales apareció un método que no
  existía en PostgreSQL: `isBasicRole` (alta de personas desde el organigrama).
  Se implementó en PostgresUsersService.
- Se quitó el login con Google (rutas `auth/google`, estrategia, botón de registro
  y página `/auth/google-callback`).
- Se borró la configuración de despliegue antigua: Firebase Hosting, Cloud Build,
  `deploy.sh`, Docker, nginx, los workflows de Cloud Run y los scripts de
  Firestore. El README describe ahora Supabase + Vercel.
- El frontend renueva el token con una sola petición compartida. Antes, varias
  renovaciones simultáneas reutilizaban el refresh token y el backend cerraba la
  sesión al vencer el access token (cada 15 minutos).
- Se eliminó el proyecto Vercel `intranet-arm-api`; solo queda `intranet_arm`.
- Verificado: 30 pruebas backend, 14 frontend, integración PostgreSQL (identidad
  con HTTP real, fichas y dominios) y producción en ecosistema.armglobal.org.

## Retiro de Cloud Run (23 de octubre de 2026)

El usuario confirmó login, acceso al dashboard y cambio de foto desde la web.
Se deshabilitaron reversiblemente los cuatro servicios de `intranet-arm`, región
`us-central1`, mediante escalamiento manual con cero instancias:

- `intranet-backend`
- `intranet-frontend`
- `intranet-backend-dev`
- `intranet-frontend-dev`

Verificación externa posterior: los cuatro endpoints run.app responden HTTP 503.
`https://intranetarm.vercel.app/api/v1/health` responde HTTP 200 y postgres ok.
El backend antiguo conserva un error previo de la revisión 00078-h5v; su ajuste
de escalamiento manual a cero sí quedó guardado. No se reparó esa revisión.

Se conservan Firestore, buckets, imágenes de contenedor, configuraciones y respaldos.
Estos recursos retenidos pueden seguir generando cargos de almacenamiento;
deshabilitar Cloud Run no equivale a eliminar el proyecto ni cerrar su facturación.
No se desactivó Firebase Hosting ni se revocaron credenciales de recuperación.
Los workflows antiguos siguen limitados a ejecución manual.

Para recuperar un servicio, revisar primero si corresponde reabrir el origen:
Cloud Run > servicio > Escalamiento > Automático (antes: mínimo 0, máximo 20).
El backend con revisión fallida necesita además seleccionar una revisión sana;
no reactivar escrituras antiguas sin conciliar los cambios hechos en Supabase.

## Un solo proyecto: intranet_arm (22 de octubre de 2026)

Estado verificado tras corregir la clave: `SUPABASE_SECRET_KEY` funciona con
Storage y está configurada en Production y Preview del proyecto unificado.
La copia local está ignorada por Git. Despliegue Production
`dpl_H4uGf9P5J5WPF27BqHH1XhWpNeKq` READY; el dominio público responde health 200
con PostgreSQL conectado. STORAGE de Production es supabase.
Buckets creados: arm-public público, arm-documents y arm-uploads privados.
Probadas subida, descarga, integridad y privacidad con imágenes sintéticas,
eliminadas al terminar. Copiados y verificados por SHA-256 los 26 archivos del
respaldo: 15 públicos (acceso anónimo comprobado en origen) y 11 privados en
legacy-backup. Manifiesto privado: migration-artifacts/storage-transfer-verified.json.
Reemplazados 15 enlaces mediante transacción con control de concurrencia:
feedback (4), org_areas (5), users (3), visual_references (3). Verificación
posterior: cero referencias al bucket antiguo en esas tablas. Las rutas privadas
y el login inválido responden 401 en el dominio de producción.
Exportación actualizada production-2026-10-22-01: 1.409 documentos; frente a
production-2026-10-21-03 solo cambiaron un contador y cuatro tokens de sesión
(tres nuevos, uno actualizado). Sin cambios nuevos de datos de negocio.
En esa exportación el origen no estaba congelado; no se importaron tokens antiguos
sobre las sesiones nuevas. Posteriormente el usuario validó login y cambio de
foto; los servicios Cloud Run fueron deshabilitados como se describe arriba.
Los respaldos y el origen permanecen conservados.

La API ya no se despliega como proyecto aparte. El proyecto Vercel `intranet_arm`
(raíz `frontend`) sirve la web y la API en `/api/v1` desde el mismo dominio:

- `backend/src/app-factory.ts` crea y configura la aplicación Nest sin escuchar.
  `main.ts` la sigue usando para el servidor local en el puerto 3001.
- `frontend/src/pages/api/v1/[[...path]].ts` inicia Nest una vez por instancia y
  le entrega cada petición sin procesar el body.
- El frontend depende de `intranet-backend` (`file:../backend`). Next lo carga con
  `require` sin empaquetarlo y el trazado de archivos incluye `backend/dist` y sus
  dependencias (unos 18 MB). `frontend/vercel.json` compila el backend antes.
- CORS admite además el propio dominio de la petición (incluye URLs de Preview).
- Desplegar desde la raíz del repo; `.vercelignore` solo sube `frontend` y
  `backend`, sin `.env`, credenciales, exportaciones ni `node_modules`.
- Variables en `intranet_arm` (Preview y Production configurados):
  DATABASE_URL (pooler, rol arm_api), JWT_SECRET nuevo, STORAGE, SUPABASE_URL,
  SUPABASE_BUCKET_PUBLIC, SUPABASE_BUCKET_DOCUMENTS, FRONTEND_URL y
  SUPABASE_SECRET_KEY. El frontend usa `/api/v1` relativo; no definir
  NEXT_PUBLIC_API_URL en Vercel.
- Preview `dpl_J7vS3oMD4biwXjbjhUKyw2VPzjWR` (con STORAGE=gcs solo en ese
  despliegue): health 200 con postgres ok, login inválido 401, ruta protegida
  401 y páginas 200.
- Al confirmar el Preview con Storage real, el proyecto `intranet-arm-api` se puede
  eliminar.

El proyecto Vercel `intranet-arm-api` fue creado en `pdencinas-projects` y la
carpeta `backend` está vinculada por CLI. El frontend existente es `intranet_arm`.
El proyecto API todavía necesita SUPABASE_SECRET_KEY y BACKEND_URL definitivo.
Ya se configuraron en Production y Preview DATABASE_URL (pooler, rol arm_api),
STORAGE=supabase, SUPABASE_URL, SUPABASE_BUCKET_PUBLIC, SUPABASE_BUCKET_DOCUMENTS,
FRONTEND_URL y un JWT_SECRET nuevo, sin exponer su valor.

## Primer despliegue de la API (22 de octubre de 2026)

- DATABASE_URL se construyó desde backend/.env.runtime.local cambiando solo
  usuario (`arm_api.kqqufmijfvrgzrfrqsby`), servidor y puerto del Transaction
  pooler, y se subió por stdin a Production y Preview como Secret.
- Desde este computador el TCP al pooler abre, pero el handshake PostgreSQL/TLS
  expira (red local). Desde Vercel funciona.
- Primer despliegue `dpl_D5j6mcNo8uuFX4pnUMKQwktoQvtN`, con `STORAGE=gcs` solo
  para ese despliegue, porque sin SUPABASE_SECRET_KEY el arranque falla. Vercel lo
  asignó a Production automáticamente por ser el primero; nada apunta a él todavía.
  Verificado: `/api/v1/health` 200 con `postgres: ok`, login inválido 401 y ruta
  protegida sin token 401. Las subidas no funcionan en ese despliegue.
- Al agregar SUPABASE_SECRET_KEY y crear los buckets, redesplegar sin el override.

## Avance de preparación (22 de octubre de 2026)

- El usuario autorizó expresamente los permisos del rol `arm_api`. La migración
  arm_backend_runtime_role se aplicó: 32 tablas accesibles exclusivamente para el
  servidor mediante ese rol. No es superusuario, no omite RLS y no accede a
  arm_migration. Login directo probado con credencial generada localmente, guardada
  solo en backend/.env.runtime.local (ignorada por Git).
- El panel confirma aws-1-ca-central-1.pooler.supabase.com:6543 para Transaction
  pooler IPv4; el usuario debe incluir el sufijo .kqqufmijfvrgzrfrqsby. Las pruebas
  desde este computador terminan en timeout; no se sustituyó todavía la conexión
  directa guardada. Verificar desde Vercel antes de configurar producción.
- Vercel frontend corregido de pdencina/intranet_arm a
  armglobalsource/intranet_arm, conservando Root Directory frontend.
- Next.js actualizado de 14.2.3 a 14.2.35 (parche de la misma rama), cliente y
  dependencia Firebase del frontend retirados porque ya no tenían consumidores.
- Cargas mayores de 3 MB en producción van directamente al bucket privado
  arm-uploads. La API emite un ticket por usuario/destino/tamaño/tipo válido diez
  minutos y vuelve a comprobar permisos al finalizar. Los archivos se verifican
  en tamaño y se procesan con los servicios existentes. El bucket debe limitarse
  a 10 MB y los MIME de imagen aceptados; sin políticas de acceso público.
  Las cargas temporales completadas se eliminan. Pendiente programar limpieza de
  las cargas abandonadas y comprobar el flujo real de extremo a extremo.
- Backend: 32 pruebas unitarias, compilación TypeScript y prueba HTTP/identidad
  con PostgreSQL aprobadas. Frontend: compilación de producción aprobada.
- La clave de Storage fue corregida y validada; está en configuración local
  privada y en el proyecto Vercel unificado, con autorización del usuario.

- StorageService admite Supabase Storage. Documentos usan bucket privado y enlaces
  firmados; las imágenes públicas usan un bucket separado. Los tres buckets ya
  están creados y las operaciones de Storage fueron verificadas.
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
- El acceso al panel se recuperó tras un error 504 del inicio de sesión.

Herramientas de traslado: inventory-storage.cjs (solo lectura), copy-storage.cjs
(copia sin sobrescribir, verifica SHA-256 del destino) y compare-exports.cjs.
Nunca incluir sus respaldos, URLs firmadas o credenciales en Git.

La migración `arm_backend_runtime_role` se aplicó después de la autorización
expresa del usuario. SQL: `backend/scripts/supabase-migration/sql/backend-role.sql`.
No otorga acceso a `arm_migration`, `anon` o `authenticated`. La autorización de
cada solicitud corresponde a los guards y servicios de NestJS.

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
entorno. Las peticiones de Vercel tienen límite de 4,5 MB: el frontend nuevo usa
carga directa para archivos mayores de 3 MB y requiere desplegar la API nueva
antes de activar ese frontend.

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
