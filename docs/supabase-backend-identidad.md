# Backend PostgreSQL: identidad y operación de campus

Implementado el 21 de octubre de 2026. **La migración completa del backend sigue
pendiente. Este bloque es una API local de ensayo, no un reemplazo del servidor
de producción.**

## Implementación

- Servicios PostgreSQL de usuarios, roles, notificaciones y autenticación.
- Controladores y contratos HTTP existentes reutilizados mediante providers de NestJS.
- Login con los hashes bcrypt existentes; JWT, registro y flujo de Google OAuth
  conservados. El flujo externo real de Google no se probó.
- Refresh con bloqueo de fila y transacción: revocación y reemplazo se confirman
  juntos. Logout registra revocaciones de access tokens y refresh tokens.
- El JWT se valida contra estado, rol, permisos y campus actuales de PostgreSQL.
  Los permisos de un token anterior no sobreviven a su retirada en la base.
- CRUD de perfiles, aprobación/rechazo, cargos manuales y cargos derivados de
  membresías, listado paginado/búsqueda SQL y notificaciones con propietario.
- Campos de trazabilidad de importación y hashes de contraseña excluidos de las
  respuestas públicas. BIGINT convertido a número solo si no pierde precisión.
- Protección de las rutas de usuarios: lectura requiere `users:view`, escritura
  administrativa requiere `users:edit`. Se permite ver el propio perfil y subir
  el propio avatar; el wizard usa su lista acotada de campos.
- Las bajas que afectarían registros históricos relacionados se rechazan con
  conflicto; no se borran esas referencias ni historiales automáticamente.

La migración remota `arm_identity_runtime_constraints` añadió
`arm_app.revoked_tokens` e índices únicos de nombre de rol normalizado y hash de
refresh token. Con el bloque de planificación hay **26 tablas en arm_app**. No se dieron grants nuevos a
roles de cliente; la API local usa la conexión configurada en `.env.supabase`.
Antes del despliegue definitivo hay que configurar un rol de ejecución limitado
y las políticas correspondientes; no usar el propietario `postgres` en producción.

## Arranque local opcional

Desde `backend`, con `DATABASE_URL` y `JWT_SECRET` configurados:

```powershell
npm run start:postgres:preview
```

Escucha exclusivamente en `127.0.0.1:3002`, configurable con
`POSTGRES_PREVIEW_PORT`. Rechaza `NODE_ENV=production`. Rutas disponibles:
`/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/notifications`.
También incorpora los controladores del bloque de campus descrito abajo.
No inicia Firebase. El arranque normal (`main.ts`)
continúa usando el backend original, sin selección implícita por `DATABASE_URL`.

Las operaciones manuales de esta API sí modifican la copia de ensayo. No apuntar
todavía el frontend publicado a esta API parcial.

## Verificación ejecutada

```powershell
npx tsc -p tsconfig.build.json --noEmit
npm test -- --pool=forks --poolOptions.forks.singleFork=true
npm run test:postgres:identity
npm run test:postgres:domains
```

TypeScript pasó; Vitest pasó 24 pruebas. La integración ejecutó consultas reales
en Supabase y arrancó los controladores HTTP en un puerto local temporal:

- Login válido e inválido y contrato de respuesta sin hashes ni metadatos internos.
- Búsqueda SQL, ID numérico y rechazo de correo duplicado.
- Permisos vigentes frente a un JWT anterior.
- Refresh, rechazo de reutilización secuencial, expiración, logout y suspensión.
- Acceso a notificaciones de otro usuario denegado.
- Rechazo de borrado de rol todavía asignado.
- HTTP 401 sin sesión, 403 para elevar el propio rol o crear roles sin permiso,
  acceso al propio perfil y restricción de cuentas pendientes.

Todos los registros de prueba están dentro de una transacción con rollback; los
IDs de secuencias consumidos pueden dejar huecos, comportamiento normal de PostgreSQL.
La prueba no envía correos, no sube archivos y usa un secreto JWT efímero.
No se ha ensayado aún la competencia de dos conexiones reales por el mismo refresh
token; el bloqueo se revisó y la reutilización secuencial sí se probó.

El asesor de seguridad solo reportó 30 avisos INFO de RLS sin políticas, esperados
en estos esquemas cerrados. [Descripción del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Bloque de campus y planificación

Implementaciones PostgreSQL conectadas a la API local de ensayo mediante
`postgres-domain.providers.ts`:

- Campus y catálogos de asistencia, voluntariado y moneda.
- Cargos: renombrar actualiza cargos manuales; eliminar retira esas referencias
  y deja sin cargo las membresías relacionadas, dentro de una transacción.
- Organigrama con áreas, equipos anidados, membresías y búsqueda de perfiles.
- Disponibilidad de voluntarios y técnicos: clave única por persona, campus,
  semana y horario, y validación completa del lote antes de escribir.
- Administradores, equipos y turnos de campus. Generar nuevamente omite los
  turnos existentes y conserva las modificaciones manuales. Las fechas de turno
  se entregan como `YYYY-MM-DD`, sin conversión a otra fecha por zona horaria.
- Canciones con conteo atómico de uso, paletas y onboarding con visibilidad por rol.
  La lectura directa de onboarding por slug también aplica la restricción de rol.

Las migraciones remotas `arm_planning_runtime_tables` y
`arm_orgchart_runtime_constraints` están conservadas como SQL en
`backend/scripts/supabase-migration/sql/`. Añaden `arm_catalogos`,
`disponibilidades_tecnicos`, relaciones de equipos padre, restricciones de
membresías e índices únicos. Las tablas nuevas no tienen datos inventados.

`test:postgres:domains` prueba estos servicios contra Supabase con datos
sintéticos dentro de una transacción que termina en rollback. Verifica
propagación de cambios de cargos, aislamiento entre campus, rechazo de horarios
inválidos sin escrituras parciales, jerarquías, equipos de campus equivocado,
generación repetida de turnos, canciones y onboarding. No equivale todavía a una
prueba de navegación completa del frontend ni de concurrencia con dos conexiones.
La integración HTTP de identidad volvió a pasar con este módulo ampliado.

Después de las pruebas se verificaron 269 usuarios, 10 campus, 22 fichas y 560
registros de historial. Los IDs de secuencias pueden presentar huecos por las
pruebas, aunque sus filas se reviertan.

## Siguiente bloque y corte

Faltan fichas, contenidos, documentos, búsqueda, feedback, referencias visuales,
estadísticas y restantes módulos/tareas de
limpieza. Algunos todavía requieren tablas porque estaban vacíos en la exportación.
No activar proveedores PostgreSQL dentro del AppModule original mientras existan
servicios que escribirían el mismo dominio en Firestore.

Después: pruebas funcionales de todos los módulos, rol limitado de base de datos,
despliegue del backend, CORS y `NEXT_PUBLIC_API_URL` del frontend; exportación final
con pausa de escrituras y conciliación antes de habilitar producción.
