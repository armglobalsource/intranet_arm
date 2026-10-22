# Tablas cargadas — 21 de octubre de 2026

Destino: `ecosistema_arm` / `kqqufmijfvrgzrfrqsby`. Esquema privado: `arm_app`.

La migración remota `arm_operational_domain_tables` creó 23 tablas tipadas. Se
cargaron desde la exportación verificada de `intranet-arm`, checksum
`449569bed5c4b9a108603ae7d14e5da8028255efb19f913b136f0eea4c882383`.
El registro de carga está en `arm_migration.operational_loads`.

| Grupo | Cantidad |
| --- | ---: |
| Registros en las 23 tablas de `arm_app` | 1.375 |
| Notificaciones con destinatario inexistente, conservadas para revisión | 12 |
| Contadores originales respaldados | 19 |
| Total conciliado con el archivo original | 1.406 |

Incluye 269 personas, 7 roles, 10 campus, 63 cargos, 195 membresías, 22 fichas,
560 entradas de historial, 92 turnos y 16 disponibilidades. Las 23 personas sin
correo permanecen sin correo; no se inventaron cuentas. Los hashes existentes
de contraseñas se conservaron. Esto no crea cuentas de Supabase Auth.

## Modelo y trazabilidad

`backend/scripts/supabase-migration/operational-model.cjs` define explícitamente
las columnas y relaciones. Conserva nombres de campos de la API; SQL debe citar
los identificadores camelCase. Las cabeceras son columnas tipadas; contenido
editorial, listas y snapshots históricos permanecen JSONB. Las membresías y
el historial tienen tablas propias. Aún se deben revisar las referencias dentro
de listas JSON y crear tablas para módulos vacíos durante la adaptación del backend.

Cada fila importada registra `document_id`, `source_path`, checksum del registro,
checksum de la exportación, campos presentes y timestamps originales. PostgreSQL
almacena microsegundos; `source_timestamps` conserva segundos y nanosegundos
originales, y el archivo privado conserva el documento completo. Los timestamps
dentro de JSONB se convierten a strings UTC con nueve decimales. Estos campos de
trazabilidad describen la importación y no deben presentarse como datos actuales
después de editar una fila.

Las secuencias numéricas comienzan por encima de los IDs existentes y respetan
el siguiente valor de los contadores originales. Las 12 notificaciones con
`userId=0` están en `arm_migration.unresolved_notifications`, sin reasignación.
El documento `tipo_cambio/_meta` se separó de las cotizaciones.

## Validaciones ejecutadas

- Checksum completo del staging antes de importar.
- Transacción única y bloqueo de carga concurrente.
- Comparación en ambos sentidos de todas las columnas importadas con la
  transformación de origen, además de conciliación del total.
- Claves foráneas en relaciones escalares, con índices.
- Rechazo efectivo de correo duplicado normalizado, equipo con área inexistente
  y turno duplicado con modalidad nula. Las pruebas se ejecutaron con rollback.
- Secuencias superiores a IDs importados, RLS activo y esquemas privados sin
  acceso para `anon`, `authenticated` ni `service_role`.

El asesor de seguridad reporta únicamente 27 avisos INFO de RLS sin políticas.
Es intencional mientras no se haya configurado un rol específico del backend:
las tablas permanecen cerradas. No agregar políticas públicas para eliminar el
aviso. [Explicación del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Reproducibilidad

Desde la raíz del repositorio:

```powershell
node backend/scripts/supabase-migration/prepare-operational.cjs migration-artifacts/production-2026-10-21-01 backend/scripts/supabase-migration/sql
node backend/scripts/supabase-migration/operational.test.cjs
```

El generador verifica origen, checksum, tipos y campos conocidos. Produce SQL
sin datos personales: la carga lee el staging privado existente. El esquema se
aplicó mediante `apply_migration` y la carga mediante `execute_sql`.
`sql/verify-operational.sql` contiene las verificaciones de base ejecutadas.

No volver a aplicar el esquema sobre estas tablas. El importador rechaza una
carga repetida o tablas ocupadas: no sobrescribe datos ni hace upserts silenciosos.
La carga definitiva requiere un procedimiento separado, probado contra una nueva
exportación; este script es el ensayo inicial y no implementa sincronización.

## Lo que sigue pendiente

La aplicación todavía utiliza Firestore. Antes del corte hay que adaptar los
servicios de NestJS, crear un rol PostgreSQL limitado y sus políticas, probar
autenticación/permisos/contratos, completar tablas de módulos sin datos y resolver
la semántica de notificaciones retenidas. La copia de sesiones es histórica: no
habilitar refresh tokens de este ensayo en producción sin renovar la exportación
de tokens y revocaciones o invalidar las sesiones al corte.

El frontend ya se publicó en Vercel según la captura del usuario. El backend y
su URL pública aún requieren configurar el despliegue. Los cambios de código
son locales; la creación y población de estas tablas sí se ejecutó en Supabase.
Google Cloud Storage y Firestore no se modificaron. El corte requiere pausa de
escrituras y una copia final actualizada.
