# Estadísticas: operación y planificación

El menú Estadísticas reúne Resumen, Operación semanal, Campus, Evolución,
Proyecciones, Calidad de datos y Registros. Registrar encuentro y Revisar reportes
se muestran según los permisos existentes. Cada vista tiene una ruta propia;
los accesos dentro del panel conservan los filtros durante la navegación, salvo
Operación semanal, que selecciona la última semana completa. Al abrir una ruta
directamente se aplican sus filtros predeterminados.

## Operación

La vista abre la última semana cerrada, de lunes a domingo según la fecha de
Chile. Permite consultar otros períodos. Muestra reportes por subir, campos
incompletos y campus activos sin registros incluidos. Estos últimos no son
incumplimientos confirmados: no existe todavía una conciliación con un calendario
de encuentros esperados. La bandeja de revisión mantiene su propio alcance.

## Proyecciones

- Ventana fija: ocho semanas cerradas inmediatamente anteriores a la semana actual.
- Filtros de país y campus respetan el alcance autorizado del endpoint existente.
- Solo encuentros aprobados con fecha de día conocido. Se excluyen eventos y
  reportes históricos de precisión mensual.
- Mínimo: seis semanas con reportes y presencia de reportes en ambas semanas más
  recientes. Sin asistencia positiva no se emite una estimación presencial.
- Base: mediana de las asistencias semanales registradas, multiplicada por cuatro.
  Las semanas sin registros no se tratan como ceros.
- Escenarios: variación elegida de ±5%, ±10%, ±15% o ±20% sobre la base.
  Son supuestos de planificación; no intervalos de confianza ni predicciones
  estadísticas de crecimiento. No modelan estacionalidad, cambios de agenda ni aforo.
- Se informa la cobertura y los reportes pendientes de subir. Un reporte por semana
  no garantiza que estén todos los encuentros; es necesario validar la cobertura
  con los responsables antes de decidir recursos.
- La métrica representa participaciones acumuladas, no personas únicas. Online y
  voluntarios no se agregan a la asistencia presencial.

## Calidad e histórico

“Histórico disponible” evita afirmar cobertura completa desde 2020. La vista de
calidad separa campos completos de cobertura: muestra primer y último registro en
el filtro, meses con algún registro y reportes cuyo día se desconoce. Los lotes de
Asana retenidos antes de importar no están en el contador operativo de pendientes.

Esta mejora no importa, corrige ni aprueba registros históricos. El registro de
8.265 de Santiago del 22/08/2021 continúa retenido por decisión del usuario.
