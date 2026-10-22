# Migración de la Intranet ARM a Supabase

Estado: exportación de ensayo y carga de 23 tablas tipadas completadas en Supabase. La aplicación continúa usando Firestore; falta adaptar el backend y hacer el corte definitivo. Ver [tablas cargadas y validaciones](supabase-tablas-cargadas.md) y [resultado del primer ensayo](estado-migracion-supabase.md).

Avance del backend: [primer bloque PostgreSQL de identidad](supabase-backend-identidad.md)
implementado y probado como API local independiente. La tabla adicional
`revoked_tokens` eleva el total a 24. El despliegue habitual no se ha cambiado.

Destino verificado: `ecosistema_arm`, ref `kqqufmijfvrgzrfrqsby`, región `ca-central-1`, PostgreSQL 17. Contiene el archivo privado `arm_migration` y 23 tablas en `arm_app`, creadas por las migraciones remotas `arm_firestore_migration_staging` y `arm_operational_domain_tables`.

Origen indicado por el usuario: `intranet-arm`, mediante el enlace a su consola Firebase. Corresponde al proyecto de producción documentado en el repositorio. El primer ensayo consiste en exportar este origen mediante solo lecturas y validar la copia antes de cambiar la aplicación. Una exportación con escrituras activas sirve para diagnóstico, no como copia final consistente.

`backend/.env` local continúa apuntando a `intranet-arm-dev-70a30` (`NODE_ENV=development`). No se modificó esa configuración ni se conectó el backend a producción. Cada exportación debe especificar `--project intranet-arm` y utilizar credenciales con acceso al proyecto correcto.

## Alcance y decisiones

- Destino: PostgreSQL en el proyecto Supabase exclusivo `ecosistema_arm` (`kqqufmijfvrgzrfrqsby`).
- Mantener Next.js, la API NestJS y sus contratos HTTP durante la transición.
- Mantener inicialmente bcrypt, JWT y Google OAuth del backend. Los usuarios actuales son documentos de la aplicación, no se debe asumir que son cuentas de Firebase Auth. Supabase Auth es una migración posterior e independiente.
- Mantener inicialmente Google Cloud Storage y las referencias a archivos existentes. Exportar Firestore no copia los archivos de los buckets.
- Mantener IDs numéricos y IDs documentales de texto según cada entidad; no convertir todos los IDs a UUID. Conservar rutas y enlaces a fichas.
- Las tablas de la aplicación deben estar en un esquema privado, fuera de la Data API, con acceso del backend mediante un rol PostgreSQL limitado. Si se expone alguna tabla, requiere grants mínimos, RLS y políticas específicas. La autenticación JWT actual no habilita por sí sola políticas basadas en `auth.uid()`.
- No usar `schema.sql` como esquema definitivo: es el MVP anterior y no contiene todos los módulos actuales.
- No construir un emulador de la API Firestore sobre una única tabla JSON. Crear repositorios SQL por dominio y mantener JSONB solo donde aporte flexibilidad.

## Inventario encontrado en el código

Este inventario proviene del repositorio, no de una consulta a la base. La exportación debe descubrir también colecciones que no aparezcan aquí.

| Dominio | Colecciones actuales | Tratamiento previsto |
| --- | --- | --- |
| Identidad | `users`, `roles`, `job_titles`, `campuses` | Tablas tipadas, correo único normalizado, FKs; cargos manuales y derivados del organigrama separados |
| Organigrama | `org_areas`, `org_teams`, `org_memberships` | Tablas relacionadas; revisar membresías históricas antes de imponer restricciones |
| Producción | `fichas`, subcolección `changelog`, `canciones`, `paletas`, `visual_references` | Fichas con cabecera tipada, contenido variable JSONB, asignaciones consultables e historial en tabla independiente |
| Disponibilidad | `disponibilidades`, `disponibilidades-tecnicos` | Unicidad por usuario, campus, semana y horario; horarios válidos y transacciones |
| Turnos | `campus_administradores`, `campus_equipos`, `campus_turnos` | Relaciones y unicidad por campus, tipo, modalidad y fecha, incluyendo modalidad nula |
| Actividad | `encuentros`, `kiloamor`, `siembra`, `tipo_cambio` | Campos tipados, índices por campus y fecha; importes con `numeric` y moneda explícita |
| Contenidos | `content`, `anuncios`, `documents`, `onboarding` | Metadatos tipados, contenido variable JSONB y reglas de acceso verificadas |
| Interacción | `notifications`, `feedback` | Destinatarios, estados, fechas e índices para paginación |
| Sesiones | `refresh_tokens`, `revoked_tokens` | Preservar hashes y revocaciones o invalidar todas las sesiones al corte; nunca conservar refresh tokens omitiendo revocaciones |
| Infraestructura | `_counters`, documento `tipo_cambio/_meta` | Respaldar; convertir contadores en identidades/secuencias ajustadas a máximos importados y separar metadatos de cotizaciones |

Algunos servicios guardan nombres y datos relacionados como snapshots. Distinguir cuáles son históricos y cuáles son copias actuales antes de normalizarlos. Eliminar toda duplicación de forma automática puede alterar el significado de datos históricos.

## Herramientas preparadas

Desde `backend`, con Node.js 20+ y las dependencias instaladas (`npm ci`):

```powershell
npm run db:export -- --help
npm run db:export -- --project ID_FIREBASE_ORIGEN --output ../migration-artifacts/ensayo-01 --credentials ./service-account.json
npm run db:inspect -- --input ../migration-artifacts/ensayo-01
npm run db:prepare-staging -- --input ../migration-artifacts/ensayo-01 --target kqqufmijfvrgzrfrqsby
npm run test:migration
```

Crear primero el directorio padre `migration-artifacts`. El directorio final de cada exportación debe ser nuevo. Se puede omitir `--credentials` si Application Default Credentials ya está configurado. Las herramientas no cargan `.env` ni eligen automáticamente un proyecto de producción.

La exportación hace solo lecturas. Recorre colecciones y subcolecciones, incluyendo descendientes de padres que ya no existen. Conserva timestamps con nanosegundos, bytes, referencias documentales por ruta y tipos numéricos especiales. Detiene la operación si encuentra un tipo no soportado. No exporta reglas de seguridad, índices, configuración IAM ni archivos de Storage.

Produce `documents.jsonl` y un `manifest.json` con proyecto de origen, recuentos y checksum SHA-256. Sin manifiesto completo, la exportación es incompleta. El diagnóstico verifica el checksum y los recuentos, inventaría tipos de campos y señala claves duplicadas, campos incompletos y referencias no resueltas. Produce `readiness.json`; código de salida 0 sin hallazgos, 2 con hallazgos a revisar, 1 en error. Los hallazgos no modifican ni descartan datos. Ciertos IDs históricos o sentinelas pueden ser válidos y requieren revisión humana.

Esta exportación recorre una base viva; no es un snapshot consistente entre documentos. Para el corte final es obligatorio pausar escrituras desde todos los clientes, scripts, tareas y servicios. `listDocuments` mantiene en memoria las referencias de cada colección y el diagnóstico mantiene los registros; medir tamaño y memoria antes de usarlos en una base grande. La inspección de tipos es de primer nivel; estructuras anidadas requieren revisar el esquema de cada dominio.

Los archivos contienen datos personales, hashes de contraseñas y hashes de sesión: mantenerlos en almacenamiento restringido y fuera de Git. En Windows, revisar también los permisos ACL del directorio; los modos POSIX de Node no sustituyen las ACL. No adjuntar exportaciones al chat ni a PRs.

`db:prepare-staging` verifica primero la exportación y genera un plan SQL local dentro de `staging` (también excluido de Git). No ejecuta SQL ni cambia la base. El esquema necesario está en `backend/scripts/supabase-migration/staging-schema.sql`; fue aplicado al destino mediante la herramienta de migraciones de Supabase. El plan contiene inicio, lotes idempotentes y validación. Verificar siempre el `targetProjectRef`, los hashes de cada archivo y el proyecto remoto antes de ejecutar los pasos secuencialmente. Un directorio `staging` ya existente no se sobrescribe.

La validación de staging compara recuentos y checksums individuales, y reconstruye la exportación original en su orden para comprobar el SHA-256 completo. `source_documents` es un archivo temporal de importación, no la tabla operativa de la futura aplicación. No exponerlo a la Data API ni dar acceso al rol del backend.

## Etapas y criterios de aceptación

1. **Origen y destino:** identificar proyecto Firebase, base Firestore (las herramientas actuales usan la base predeterminada) y proyecto Supabase de desarrollo. No reutilizar otro producto sin revisar su contenido.
2. **Ensayo de exportación:** obtener inventario real; revisar tipos inconsistentes, IDs duplicados, referencias, datos históricos y enlaces a archivos. Resolver o documentar cada hallazgo.
3. **Esquema actualizado:** diseñar tablas, FKs, restricciones, índices, reglas de borrado, permisos y migraciones versionadas. Preservar precisión temporal y monetaria; distinguir fechas civiles de instantes UTC. Usar la CLI para generar archivos de migración.
4. **Importador:** cargar en un esquema de staging privado, registrar proyecto y checksum de origen, transformar explícitamente los datos y validar antes de publicar tablas. Debe soportar reintentos sin duplicar registros, registrar errores sin exponer secretos y negarse a sobrescribir destinos ajenos.
5. **Backend:** sustituir FirebaseService por repositorios PostgreSQL por dominio. Rehacer transacciones, operaciones batch, actualizaciones con rutas anidadas, timestamps y generación de IDs. Ajustar también health check y limpieza de tokens. Conservar autorización por campus y rol y corregir las fugas detectadas en documentos/búsqueda.
6. **Pruebas:** comparar recuentos, IDs y datos por entidad, historiales, importes, fechas, estados y relaciones. Probar login/refresh/logout, cuentas pendientes, cambio de rol/campus, acceso denegado entre campus, fichas públicas, edición concurrente, disponibilidad, turnos y reportes. Confirmar que el frontend recibe el mismo contrato y que los enlaces antiguos funcionan.
7. **Corte:** respaldo de origen y destino, ensayo de restauración, pausa total de escrituras, exportación final, importación y conciliación. Actualizar secretos y despliegue solo tras validar el destino. Reiniciar escrituras en Supabase y comprobar métricas y errores.
8. **Reversión:** antes de admitir nuevas escrituras, volver a Firestore permite reutilizar el origen congelado. Después de nuevas escrituras en Supabase, volver requiere exportar y reconciliar esos cambios; cambiar solo la variable de conexión perdería datos.

## Pendientes que bloquean el cambio real

- Verificar URL y Root Directory de Vercel: el usuario informó que configuró `DATABASE_URL` e hizo redeploy, pero todavía no se verificó el despliegue. La conexión local en `backend/.env.supabase` ya fue comprobada mediante solo lectura y TLS validado. NestJS ahora carga ese archivo como configuración opcional y dispone de `DatabaseModule`; los servicios de dominio todavía usan Firestore.
- Primera versión del esquema y transformación de staging completadas y verificadas. Faltan repositorios SQL, tablas para módulos vacíos, normalización adicional de listas cuando corresponda y ensayo funcional de la aplicación.
- Confirmar la ventana de corte antes de pausar escrituras o cambiar la aplicación de producción. La copia actual es un ensayo con el origen activo.
- La credencial encontrada en el antiguo script PostgreSQL → Firestore debe rotarse en el proveedor y retirarse del historial por separado. Quitar el literal del archivo actual no revoca la credencial ni borra commits anteriores.

Referencias: [conexiones PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [JSONB](https://supabase.com/docs/guides/database/json), [seguridad de la API](https://supabase.com/docs/guides/api/securing-your-api).
