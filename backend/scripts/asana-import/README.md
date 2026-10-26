# Histórico de Asana

Importación del proyecto `1185873534171121` hacia `arm_app.encuentros`, dentro del repositorio del ecosistema. El frontend no depende de Asana.

## Preparación

`prepare.py` usa únicamente la biblioteca estándar de Python. Requiere el CSV de **tareas** con campos personalizados, un catálogo JSON de campus verificado con la BD y una lista explícita de campus históricos autorizados. Los archivos privados se generan dentro de `/migration-artifacts/`, excluido de Git.

```powershell
python -B backend/scripts/asana-import/prepare.py --csv '<archivo.csv>' --catalog migration-artifacts/<lote>/catalog.json --historical migration-artifacts/<lote>/historical.json --as-of 2026-10-25 --output migration-artifacts/<lote>
```

Incluye solo tareas `Finalizada` + `Registrado`, fecha válida hasta el corte, campus inequívoco y al menos una cifra informada. Retiene para revisión subtareas, fechas discordantes con secciones mensuales, campus desconocidos, cifras inválidas y todos los candidatos con igual campus/fecha/nombre. No corrige fechas ni decide qué duplicado conservar. Las coincidencias por nombre no detectan todos los posibles duplicados; la revisión del origen sigue siendo necesaria.

`Santiago Centro` se corresponde con `Santiago`. Miami (Estados Unidos), Oriente (Chile) y Virtual (sin país) fueron autorizados como campus históricos inactivos. No asignar usuarios del ecosistema a partir del responsable de Asana.

Después de la carga, el usuario confirmó que Miami, Oriente y Virtual son campus vigentes; quedaron activos. Una repetición del importador conserva el estado actual de los campus existentes, no vuelve a desactivarlos.

**Reportes de solo mes (Montevideo).** El origen cargó la fecha `2022-04-05` en los reportes semanales de Montevideo de julio de 2021 a marzo de 2022. Con autorización del usuario (25-10-2026) se incorporan por el mes de su sección, sin inventar el día: `fechaPrecision: 'mes'`, `periodo: 'AAAA-MM'`, `fecha` = primer día del mes (solo por compatibilidad con el almacén) y `source.originalDate`/`source.dateRule`. Solo aplica a Montevideo con esa fecha; cualquier otra fecha discordante sigue retenida. Si además la tarea no está Finalizada/Registrada o no tiene cifras, sigue retenida (hoy 1 de las 67). Estos reportes no se consideran duplicados entre sí (comparten fecha y nombre por el error de carga) y se identifican por su ID de tarea. En las estadísticas cuentan en el mes completo, en totales y por campus, y nunca en una semana ni en un rango que no cubra el mes entero.

Los campos vacíos permanecen ausentes; `0` se conserva como cero informado. `2.0` se convierte a 2; fracciones, negativos, separadores ambiguos y texto se retienen para revisión. Asistencia = auditorio + kids + tweens + sala bebé; voluntarios y espectadores online se mantienen separados. Info y Proyecto educativo se conservan como categorías de voluntarios. Los registros importados son `enviado`, no se inventa una validación pastoral.

Cada registro conserva ID del proyecto/tarea, hash del CSV y de la fila, campus/estados/tipo originales y sección. El CSV completo queda en el respaldo local; no se copian correos de responsables ni notas libres a la aplicación. Los nombres originales de encuentros y mensajes se preservan.

## Simulación y aplicación

Desde `backend/`, usando la conexión existente en `.env.supabase` (no imprimir ni versionar sus valores):

```powershell
node scripts/asana-import/apply.cjs ../migration-artifacts/<lote>/plan.json
node scripts/asana-import/apply.cjs ../migration-artifacts/<lote>/plan.json --apply --sha256 <hash-del-plan-revisado>
```

Con un enlace lento a la base (se midieron ~35 KB/s; la lectura completa son ~5 MB) el límite de 60 s no alcanza: `ASANA_IMPORT_TIMEOUT_MS=480000 node scripts/asana-import/apply.cjs …` lo amplía (sin la variable, sigue en 60 s). En una aplicación real esa lectura ocurre con los bloqueos tomados, así que conviene correrla desde una conexión rápida y fuera de horarios de captura de reportes.

La simulación es de solo lectura. La aplicación valida la huella del plan y la del CSV, catálogo y proyecto de destino. Usa una sola transacción y bloqueos breves en campus/encuentros para evitar escrituras concurrentes durante la conciliación. Crea únicamente los campus históricos que faltan, usa sus secuencias existentes y no altera permisos ni esquema. Inserta IDs deterministas `asana:<proyecto>:<tarea>`; una repetición idéntica no inserta nada, y un registro existente cambiado provoca rechazo, nunca sobrescritura. También rechaza coincidencias de campus/fecha/nombre con registros existentes de otro ID.

Antes de confirmar la transacción se comparan todos los documentos y los totales por campus. Si algo falla se revierte toda la carga. Se guardan `before-<hash>.json`, `applied.json`, `review.json` y `review.md` en el lote local. Para una eventual reversión posterior, revisar esos archivos y retirar solo IDs del lote que aún coincidan exactamente con los datos importados; no borrar registros modificados ni campus referenciados. La reversión requiere autorización específica, no se ejecuta automáticamente.

Pruebas:

```powershell
python -B -m unittest discover -s backend/scripts/asana-import -p 'test_*.py'
# Desde backend:
node --test scripts/asana-import/apply.test.cjs
```

## Auditoría posterior

`python -B backend/scripts/asana-import/audit_history.py migration-artifacts/<lote>` compara los valores numéricos informados del CSV con los incluidos en el plan y los retenidos. Las categorías principales de revisión son excluyentes y suman exactamente las tareas retenidas. Los totales brutos del CSV no son cifras oficiales: pueden incluir resúmenes, estados pendientes y posibles duplicados. Un campo inválido se señala en el plan; los demás valores de esa fila siguen visibles en la auditoría.

La búsqueda de coincidencias online compara fecha y hora entre Virtual y Santiago/Puente Alto. Es una detección de candidatos, no una prueba exhaustiva de ausencia de duplicados ni una regla automática para redistribuir audiencias.

**Atribución al campus Virtual.** No modifica registros ni necesita importación: el servicio de estadísticas la calcula al leer. Se atribuyen a Virtual las cifras online (espectadores y decisiones online) de los reportes de Santiago y Puente Alto cuya `modalidad` o nombre dicen explícitamente «Online» o «Virtual» (hoy `Presencial+Online`), conservando el campus emisor. Se muestra como una vista aparte y no se suma a los totales ni a la tarjeta del campus emisor, por lo que el global cuenta cada cifra una sola vez. Los reportes de modalidad `Presencial` con espectadores no se atribuyen.

## Revisión de reportes del ecosistema

Los reportes nuevos se crean como `enviado` y esperan revisión. El administrador listado en el campus, o quien tenga `encuentros:review` en ese campus, puede subirlos (`subido`) o devolverlos (`observado`) con un comentario. El autor puede corregir un observado y reenviarlo; un reporte subido solo lo modifica el revisor. La revisión no elimina pendientes por antigüedad. Los cambios concurrentes de revisión/edición se rechazan para evitar sobrescribir una aprobación.

Estadísticas y el resumen de encuentros usan el mismo criterio: cuentan subidos, validados y el legado sin estado. Los importados de Asana se consideran ya registrados; una observación explícita los excluye hasta nueva aprobación. Los avisos son internos, al revisor o al autor, y un fallo de notificación no impide guardar.

Conciliación del lote mensual: 66 reportes con 767 asistencias, 446 participaciones de voluntarios y 12 decisiones presenciales. La tarea restante de las 67 está Sin iniciar/Pendiente y no contiene cifras. El plan completo tiene 4.440 reportes preparados y 173 tareas retenidas; no se deben sumar automáticamente los retenidos, incluidos resúmenes anuales sin campus.
