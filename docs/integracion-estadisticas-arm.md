# Integración de Estadísticas ARM

Revisión de código: 24 de octubre de 2026.

- Origen: https://github.com/pdencina/estadisticas-arm
- Revisión examinada: `060d2d53b5caabfeee615c83fa04dad1c5d7c9af` (main al consultar GitHub).
- Ecosistema examinado: `3d6bdf4`.
- Alcance: comparación estática del código y migraciones. No se consultaron bases de producción, no se importaron registros ni se verificó que las migraciones del origen estén aplicadas en su instancia.

## Dictamen

La integración es viable. Ambos frontends usan Next.js 14.2.35, React 18.3.1, TypeScript y Tailwind. El origen aporta pantallas y lógica de negocio aprovechables. Es necesario adaptar el acceso a datos y los permisos a la API NestJS del ecosistema; no ejecutar sus migraciones iniciales sobre la base actual.

El resultado propuesto es un módulo dentro del mismo acceso, menú, despliegue Vercel y base Supabase del ecosistema. Se reutilizan usuarios y campus existentes.

## Funciones y destino

| Función del origen | Estado del ecosistema revisado | Integración propuesta |
| --- | --- | --- |
| Indicadores semanales y comparación con la semana anterior | Resumen anual agrupado por mes o semana | Añadir resumen semanal con períodos comparables |
| Vista pastoral | No se encontró una pantalla equivalente dedicada | Añadir vista resumida según permisos, con decisiones, asistencia y reportes pendientes |
| Vista ejecutiva histórica | Comparaciones anuales limitadas al año consultado | Incorporar tendencias mensuales, evolución anual y comparación por campus y país |
| Reportes de encuentros y desglose de asistencia/voluntarios | Ya existen DTO, API y registros de encuentros | Ampliar el modelo y formulario existentes sin crear otro registro paralelo |
| Pendiente → enviado → validado | Los DTO revisados no incluyen ese flujo | Añadir transiciones controladas por permisos y auditoría |
| Informes semanales almacenados y descarga CSV | No se encontró equivalente en el módulo actual | Incorporar cierres semanales reproducibles, con versión y exportación |
| Contador de decisiones («almas») | Ya se agregan decisiones presenciales y online | Calcular desde los registros elegibles; evitar sumar repetidamente informes |
| Importación desde Asana | El origen incluye scripts y un CSV | Tratarla como una migración separada con conciliación y deduplicación |

Los gráficos revisados del origen usan componentes React y CSS; no requieren introducir una biblioteca externa de gráficos para reutilizar sus ideas.

## Correspondencia de datos

| Origen | Ecosistema | Tratamiento |
| --- | --- | --- |
| `public.campus.id` (UUID) | Campus existentes con identificador numérico | Tabla de correspondencias explícita por campus, ciudad y país; no emparejar solo por nombre |
| `user_profiles` vinculado a `auth.users` | Usuarios y sesión del backend actual | Conservar el acceso actual; resolver autores históricos por correspondencia verificada |
| `public.encuentros` con columnas | `arm_app.encuentros` mediante `ArmRecordStore` y datos JSON | Convertir cada registro mediante adaptador versionado |
| `fecha` | `fecha` | Fecha calendario; fijar zona horaria y cortes semanales |
| `tipo` (domingo, oración, mujeres, etc.) | `tipo` = encuentro/evento | Mantener ambos conceptos con un subtipo adicional; no reemplazar el discriminante actual |
| `horario` | `encuentro` / `eventoHorario` | Conservar horario y etiqueta como datos distintos |
| `nombre_mensaje` | `mensaje` | Correspondencia directa |
| `acepto_jesus_presencial` | `presencial.acepto` | Correspondencia directa |
| `online.acepto_jesus` | `online.acepto` | Correspondencia directa |
| `online.espectadores_max` | `online.espectadores` | Mantener la definición de máximo por encuentro, sin presentarlo como personas únicas |
| `asistencia.sala_bebe`, `sala_sensorial`, `cambio` | `bebe`, `sensorial`, `cambios` | Homologar con catálogos de categorías |
| `voluntarios.amor_por_la_casa`, `sala_sensorial`, `punto_siembra` | `amor`, `sensorial`, `siembra` | Homologar con catálogos de categorías |
| `total_general` manual | `totalAsistencia` calculado en servidor | Conservar total declarado y suma de categorías por separado al importar; reportar diferencias |
| `lideres_voluntarios`, `admins_campus` | `lideres`, `adm` | Conservar texto histórico sin inventar asociaciones a personas |
| `estado` | Sin equivalente en los DTO actuales | Incorporar estado y trazabilidad sin ocultar automáticamente los registros existentes |

Cada registro importado debe guardar procedencia e ID original. Repetir una importación no debe crear duplicados. Conservar información histórica no reconocida hasta resolverla.

## Correcciones necesarias detectadas en el origen

1. **Acumulado no idempotente.** `lib/actions/informes.ts` toma el último `contador_almas`, suma el total semanal y actualiza el informe si ya existe. Si el último informe es el de esa misma semana, regenerarlo suma sus decisiones otra vez. Calcular el acumulado desde encuentros elegibles hasta el cierre, o desde un cierre anterior estricto y controlado.
2. **Estados inconsistentes.** `getDashboardKPIs` y `getHistoricoSemanal` en `lib/queries/encuentros.ts` incluyen solo `enviado`; la vista ejecutiva y los informes incluyen `enviado` y `validado`. Validar un reporte no debe quitarlo de los indicadores semanales.
3. **Comparaciones anuales desiguales.** `lib/queries/ejecutivo.ts` compara el año corriente parcial con el año anterior completo. Para crecimiento, comparar fechas equivalentes y mostrar «sin base comparable» si el denominador es cero.
4. **Errores que parecen ausencia de datos.** Varias consultas paginadas solo leen `data`; un error puede cortar el ciclo y devolver totales parciales. Propagar errores, ordenar la paginación de manera estable y evitar escanear todo el histórico en cada petición.
5. **Autorización que no debe trasladarse.** En `001_initial.sql`, el trigger toma `rol` de `raw_user_meta_data` y la política de actualización propia no protege columnas administrativas. La migración revisada permitiría cambios indebidos si se aplicara tal cual con los privilegios correspondientes. Reutilizar los permisos del backend actual. Esto es un hallazgo del código, no una comprobación de la instancia desplegada del origen.
6. **Contrato desalineado.** La migración 005 incorpora tipos que no están todos en `TipoEncuentro` ni en el selector del formulario. Centralizar el catálogo para formulario, validación y reportes.
7. **CSV sin escape.** La descarga concatena nombres de campus directamente: comas, saltos de línea y valores interpretables como fórmulas requieren tratamiento antes de abrir en una hoja de cálculo.
8. **Definición de métricas.** Sumar asistencias a encuentros representa participaciones acumuladas, no asistentes únicos. Tampoco las decisiones registradas garantizan personas únicas. Explicar cada indicador y mantener presencial/online separados cuando corresponda.

## Orden de implementación recomendado

### 1. Panel integrado sobre los registros existentes

- Mantener `/dashboard/produccion-general/estadisticas` como entrada.
- Filtros de país, campus y fechas, respetando el alcance de cada usuario en servidor.
- Resumen: asistencia, auditorio, voluntarios y decisiones presenciales/online.
- Comparación semanal y tendencias con intervalos equivalentes.
- Vistas Resumen, Evolución y Campus; preservar la calidad de datos del módulo actual.
- Documentar definiciones, períodos sin datos y última actualización.

### 2. Captura, aprobación y cierre

- Adaptar el formulario con tipos de encuentro, horario, revisión previa y estados.
- Permisos para registrar, revisar, validar y consultar otros campus; no asignarlos por el nombre del cargo pastoral.
- Auditoría del autor, cambios, aprobación y validación.
- Informes semanales reproducibles y exportación CSV.
- Definir el tratamiento de registros actuales sin estado antes de activar filtros por aprobación.

### 3. Histórico del proyecto anterior

- Obtener una exportación del proyecto de Asana que contiene los datos oficiales; el usuario confirmó que eliminó el proyecto Supabase anterior.
- Vista previa de correspondencias de campus, usuarios y categorías.
- Comparar conteos y totales por campus/fecha antes y después.
- Distinguir registros ya importados desde Asana y posibles solapamientos con el ecosistema.
- Importación idempotente, informe de rechazos y mecanismo de reversión por lote.

## Criterios de aceptación

- Un usuario de campus no accede a otro alterando parámetros o IDs.
- Reportes pendientes no entran en resultados oficiales; validar no reduce resultados.
- Regenerar un informe o repetir una importación no aumenta los totales.
- Cambio de año, zona horaria, semanas incompletas y denominador cero tienen resultados definidos.
- Totales y categorías se concilian con casos conocidos, preservando discrepancias históricas.
- Campus inactivos siguen presentes en su historia; no se fusionan campus homónimos.
- Las pantallas usan la sesión actual, son utilizables en móvil y muestran errores de carga.

## Fuente del histórico

El usuario identificó Asana como fuente oficial del histórico: https://app.asana.com/1/1185344329257213/project/1185873534171121/list/1204748178826867. El proyecto Supabase anterior fue eliminado; las tablas del repositorio sirven como referencia estructural. Ante fallos del conector, el usuario aportó el CSV de tareas con campos personalizados el 25 de octubre de 2026. La carga y los casos pendientes se detallan a continuación.

## Primera entrega integrada

Implementada en el repositorio del ecosistema, con API NestJS y sesión existentes:

- Vistas Resumen, Evolución, Campus y Registros, con diseño claro y adaptación móvil.
- País/campus, tipo y fechas; períodos rápidos por fecha de Chile y rangos personalizados de hasta 366 días.
- Comparación con un período inmediatamente anterior de igual duración; porcentaje sin base se muestra explícitamente. No es comparación interanual.
- Auditorio y decisiones presenciales/online, categorías, calidad de datos y búsqueda sin tildes.
- Campus inactivos incluidos; nombres ambiguos no se asignan automáticamente. El ID de campus prevalece y no se reemplaza por un nombre coincidente cuando es desconocido.
- Registros existentes sin estado conservados; enviados/validados incluidos y otros estados excluidos. El flujo de aprobación sigue pendiente de la segunda fase.
- Opciones de filtros limitadas por permisos en servidor y caché del frontend separada por usuario, campus y permisos.
- Sin nuevas tablas, cambios de autenticación ni dependencia en ejecución de `estadisticas-arm`.

Validación: 71 pruebas de backend, 47 de frontend y 7 de navegador; compilación TypeScript del backend aprobada. Las pruebas funcionales usan datos controlados, sin insertar datos de ejemplo en producción.

Antes de cargar el histórico, una consulta de solo lectura al proyecto `kqqufmijfvrgzrfrqsby` confirmó que `arm_app.encuentros` estaba vacía.

## Importación histórica — 25 de octubre de 2026

- CSV recibido: 4.613 tareas, sin IDs de Asana repetidos.
- Insertados y conciliados: **4.374 reportes**, correspondientes a 2020–2026.
- Retenidos para revisión: **239 tareas**, conservadas en el CSV y el informe local; no forman parte de los totales publicados.
- Campus históricos autorizados: Miami (Estados Unidos), Oriente (Chile), Virtual (sin país). Creados inactivos, sin usuarios ni permisos adicionales.
- Se conservaron ID de tarea, huellas del origen, estados y etiquetas; no se inventaron autores, fechas ni cifras ausentes.
- Solo se cargaron Finalizada + Registrado como `enviado`. La asistencia excluye voluntarios y espectadores online, que mantienen sus propios indicadores.
- Aplicación en una transacción, sin reemplazos ni borrados, con comparación completa de documentos y totales por campus antes de confirmar.
- Simulación posterior: 4.374 existentes, **0 nuevas inserciones**.
- Verificación con el servicio real de estadísticas y Supabase: conteos y totales coinciden por cada año; alcance de campus verificado. Semana 12–18 de octubre de 2026: 17 reportes y 1.982 asistencias.
- 15 pruebas específicas del importador aprobadas.

Motivos de revisión superpuestos: 142 tareas no finalizadas/registradas, 75 posibles duplicados, 69 fechas discordantes con sección, 41 sin cifras informadas, 15 sin campus resuelto, 13 sin fecha válida, una subtarea y un campo numérico inválido. Destacan 67 tareas de Montevideo con fecha repetida 2022-04-05. No corregirlas por suposición.

Código y procedimiento: `backend/scripts/asana-import/`. Respaldo, plan, conciliación y revisión detallada: `migration-artifacts/asana-2026-10-25/`, excluido de Git por contener datos del origen. No se necesita un nuevo despliegue para consultar los registros importados.

### Revisión posterior del histórico

El usuario aclaró que Miami, Oriente y Virtual siguen vigentes. Se activaron los tres campus; Virtual mantiene país nulo y representa el campus global online, con emisiones de los miércoles (oración y global) y domingos 11:00 desde Santiago o Puente Alto. No se cambió la atribución contable de los registros sin confirmar su alcance histórico.

La auditoría de todo el CSV detectó que Virtual tiene registros solo en 2020–2021 (hasta junio de 2021) y las cifras online bajo Santiago/Puente Alto comienzan en julio de 2021. No hubo candidatos con igual fecha/hora y espectadores positivos entre Virtual y esos emisores; esto no equivale a deduplicación exhaustiva. Está pendiente confirmar si todo ese online debe atribuirse a Virtual.

Las 67 tareas de Montevideo con fecha 2022-04-05 contienen 60 combinaciones distintas de cifras y están clasificadas en secciones de julio de 2021 a marzo de 2022. Suman 767 asistencias y 446 voluntarios. Se consultó si conservar precisión mensual, sin inventar un día.

De las 239 tareas retenidas, 192 contienen cifras positivas. Además existen seis resúmenes anuales de decisiones de fe de 2014–2019 (2.342 decisiones), sin campus ni fecha de encuentro. Requieren tratamiento como agregados históricos, no como encuentros ficticios. Los totales actuales siguen siendo parciales hasta resolver estas categorías. Detalle local: `historical-audit.json`.

## Archivos de referencia

- Origen: `types/index.ts`, `components/forms/NuevoReporteForm.tsx`, `components/charts/EjecutivoCharts.tsx`, `app/pastor/page.tsx`, `app/ejecutivo/page.tsx`, `lib/queries/encuentros.ts`, `lib/queries/ejecutivo.ts`, `lib/actions/informes.ts`, `supabase/migrations/001_initial.sql`.
- Destino: `frontend/src/app/dashboard/produccion-general/estadisticas/EstadisticasClient.tsx`, `backend/src/estadisticas/postgres-estadisticas.service.ts`, `backend/src/estadisticas/estadisticas.controller.ts`, `backend/src/encuentros/dto/encuentro.dto.ts`, `backend/src/encuentros/postgres-encuentros.service.ts`, `backend/src/common/database/arm-record-store.ts`.
