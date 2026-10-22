# Resultado del primer ensayo — 21 de octubre de 2026

Actualización: después de este ensayo se crearon y poblaron 23 tablas privadas
en `arm_app`. Ver [resultado de la carga operativa](supabase-tablas-cargadas.md).
Los pendientes de esquema descritos abajo corresponden al estado del primer
ensayo; la adaptación del backend y el corte definitivo siguen pendientes.

Origen: Firestore `intranet-arm`, base predeterminada. Destino: Supabase `ecosistema_arm`, ref `kqqufmijfvrgzrfrqsby`.

## Operaciones completadas

- Se verificó que la cuenta de servicio local corresponde al proyecto de origen y se ubicó en `backend/service-account.json`, excluido de Git. Su contenido no se incorporó a código ni documentación.
- Se instalaron las dependencias del backend con `npm ci`.
- Se exportaron **1.406 documentos** de **22 colecciones raíz**, incluidos **560 registros de historial** de fichas. No se encontraron documentos padre ausentes con descendientes existentes.
- Se generaron manifiesto, checksum SHA-256 y diagnóstico local. Ubicación: `migration-artifacts/production-2026-10-21-01/`, excluida de Git.
- Se creó el esquema privado `arm_migration` en Supabase, con las tablas `runs` y `source_documents`, para el archivo temporal de importación.
- Se ejecutó un plan de 41 pasos, incluyendo carga y validación. El ensayo quedó con estado **verified**.
- Se comprobaron recuentos por colección y coincidencia del checksum del contenido completo reconstruido en PostgreSQL. No hubo diferencias.
- Se verificó que `anon` y `authenticated` no tienen acceso al esquema ni lectura de los documentos. También se revocaron privilegios de `PUBLIC` y `service_role` sobre este staging.
- Las seis pruebas locales de las herramientas pasan. No equivalen a pruebas de la aplicación sobre PostgreSQL.

## Recuentos principales

| Entidad | Documentos |
| --- | ---: |
| Personas (`users`) | 269 |
| Campus | 10 |
| Roles | 7 |
| Cargos | 63 |
| Áreas del organigrama | 5 |
| Equipos del organigrama | 27 |
| Membresías | 195 |
| Fichas | 22 |
| Historiales de fichas | 560 |
| Turnos de campus | 92 |
| Disponibilidades | 16 |
| Notificaciones | 37 |

El manifiesto incluye los recuentos de todas las colecciones, incluidos contadores y sesiones.

## Hallazgos que afectan al modelo final

- **23 personas no tienen correo.** Se conservaron. El esquema final debe permitir personas sin acceso de login y no inventar correos para satisfacer una restricción `NOT NULL`. Los correos presentes pueden tener un índice único normalizado.
- **12 notificaciones tienen `userId=0`, sin un usuario correspondiente.** Se conservaron en staging. Antes de crear una FK obligatoria, revisar su semántica; no reasignarlas automáticamente a un administrador ni crear un usuario ficticio.
- No se encontraron duplicados en las claves de negocio revisadas. Esto es un resultado del conjunto exportado y de las comprobaciones actuales, no una garantía general contra escrituras concurrentes futuras.
- No se detectaron tipos incompatibles entre los campos de primer nivel presentes. Todavía falta revisar estructuras anidadas, campos ausentes y reglas funcionales por dominio.
- El asesor de Supabase produjo dos avisos informativos por RLS sin políticas en las dos tablas privadas de staging. Es intencional: no hay acceso para clientes y no se debe crear una política permisiva para silenciar estos avisos. [Descripción del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Pendientes antes de usar Supabase en la aplicación

La conexión PostgreSQL local del destino ya se configuró en `backend/.env.supabase` y pasó `npm run db:check` mediante una consulta de solo lectura con TLS verificado. El backend incorpora un módulo de conexión opcional, pool acotado y transacciones con rollback y liberación de conexiones. Los servicios de dominio siguen usando Firestore.

Se incorporó la CA pública de Supabase al código para verificar la cadena TLS sin desactivar `rejectUnauthorized`. No es una clave privada. El certificado se validó como CA, con firma propia válida y vigente hasta abril de 2031.

El usuario informó que configuró `DATABASE_URL` e hizo redeploy en Vercel. Esto no fue verificado: aún falta la URL de la aplicación y su Root Directory. Las modificaciones actuales del backend son locales y no se han publicado mediante Git.

1. Verificar el proyecto Vercel y qué aplicación ejecuta. Si solo ejecuta `frontend`, la conexión PostgreSQL debe configurarse además donde se ejecute NestJS.
2. Crear el modelo relacional, relaciones e índices, transformar la copia de ensayo sin perder IDs y adaptar los servicios de NestJS.
3. Probar permisos, login, fichas, turnos, disponibilidad y estadísticas contra PostgreSQL.
4. Programar un corte con pausa de escrituras y nueva exportación final. La copia actual procede de un origen activo; no es un snapshot transaccional ni garantiza contener cambios posteriores.

La aplicación y sus despliegues siguen apuntando a Firestore. Los archivos de Google Cloud Storage no se han transferido. La copia de ensayo en Supabase no significa que la migración operativa esté terminada.
