# Control semanal de reportes

La entrada operativa es **Estadísticas → Control de reportes** (`/dashboard/produccion-general/estadisticas/operacion`). El resumen conserva los indicadores e histórico; la bandeja concentra las tareas semanales.

## Cómo operar

1. Seleccionar el campus y la semana. La vista inicial muestra todo el tramo de seguimiento hasta hoy, para no esconder atrasos anteriores.
2. Abrir **Faltantes → Registrar**. El campus, la fecha y el encuentro quedan elegidos. Confirmar que el encuentro ocurrió y completar sus cifras reales.
3. Enviar el reporte. Deja de ser faltante y queda **Por revisar**.
4. El administrador revisa las cifras y aprueba el reporte, o lo devuelve con una observación.
5. Corregir los **Observados**. Solo los aprobados alimentan los indicadores; el histórico importado conserva su tratamiento como aprobado.
6. Revisar las alertas de fechas y los campus sin horarios antes de cerrar la semana.

## Cálculo y límites

- Por campus con horarios: comienza el lunes de la semana de su último encuentro diario importado de Asana. Incluye huecos de esa semana y todos los posteriores, sin el antiguo límite de 120 días. Un nuevo reporte manual no desplaza ese corte.
- Sin importación propia: se toma el corte global de importación (o el primer reporte propio si es anterior). El sistema muestra el inicio utilizado; no afirma cobertura histórica anterior a ese inicio.
- Compara por campus, fecha y hora. Un duplicado no cubre otro horario. Tolera una diferencia de hasta 30 minutos solo cuando queda un único horario candidato; los reportes sin hora no cubren encuentros automáticamente.
- Los eventos y los históricos de precisión mensual no cubren encuentros semanales.
- Los encuentros aparecen dos horas después del inicio, usando el corte operativo de Chile. No se incluyen encuentros futuros. No se modelan por ahora calendarios históricos de cambios de horario, suspensiones ni zonas horarias independientes por campus.
- Faltante significa **sin reporte para un horario previsto**, no confirmación de que el encuentro ocurrió. No se crean registros con cero asistentes ni se aprueban datos automáticamente.
- Miami y Oriente requieren sus horarios. Virtual no genera otro pendiente por una transmisión ya reportada por el campus emisor.
- Se aplican los permisos del servidor: campus propio, alcance global autorizado o campus donde figura como administrador. El control devuelve solo metadatos operativos de los campus autorizados.

## Auditoría del 4 de noviembre de 2026

Consulta de producción de solo lectura y cálculo con corte a las 23:00 de Chile. 4.440 registros disponibles; los últimos reportes por campus varían. Resultado según los horarios actuales:

| Campus | Último reporte | Faltantes calculados |
| --- | --- | ---: |
| Santiago | 18/10/2026 | 17 |
| Puente Alto | 18/10/2026 | 6 |
| Punta Arenas | 18/10/2026 | 6 |
| Montevideo | 18/10/2026 | 6 |
| Maracaibo | 11/10/2026 | 6 |
| La Plata | 04/10/2026 | 4 |
| Katy | 11/10/2026 | 3 |
| Barquisimeto | Sin registros | 2 |
| Puerto Natales | Sin registros | 2 |
| Concepción | 24/10/2026 | 1 |
| **Total calculable** | | **53** |

Miami (último 28/09/2025) y Oriente (29/12/2024) quedan por configurar, no como campus al día. Virtual conserva su histórico y la atribución online existente. Se detectó además un reporte cuyo día escrito no coincide con la fecha; no se corrigió automáticamente.

No se modificaron datos, políticas RLS ni tablas de producción. La consulta operativa utiliza el índice existente de fecha y filtra por campus y su propio inicio de seguimiento. Los resultados cambian al ingresar reportes o ajustar horarios.

## Validación

Pruebas de reglas de pendientes, persistencia de huecos, estados, permisos por campus, prevención de duplicados y registros mensuales. Pruebas de navegador con API simulada a 320, 393, 834 y 1440 px; registro, oración, revisión, filtros, indicadores históricos y proyecciones. TypeScript de frontend y backend.
