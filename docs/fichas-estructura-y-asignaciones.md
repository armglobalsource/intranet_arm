# Estructura y asignaciones de fichas

Estado: implementación compatible preparada a partir de los seis PDF. No se
reescriben fichas históricas ni se asignan personas automáticamente en producción.

## Implementación

- Selector por ID para puestos, VIO, posiciones, voluntarios, cantante de cada canción
  y responsable de cada momento. Hasta diez personas y una nota independiente.
- Estados explícitos: personas, por confirmar, fija, secuencia, no aplica y equipo.
- Aplicación al encuentro actual, al bloque AM/PM o a toda la ficha. Una excepción
  expande los datos compartidos conservando los valores de los otros encuentros.
- Una ficha por bloque, conforme a los horarios del mantenedor de campus. Plantilla
  estándar de Puente Alto (incluye dos posiciones centrales) o Santiago; la estructura
  anterior y el flujo de oración siguen disponibles. No se copian nombres ni horas
  del PDF a eventos futuros. Plataforma y timing varían por encuentro.
- `Row.assignments[shared|encuentroId]` guarda modo, lista `{userId,name}` y nota.
  `Row.values` conserva la representación legible para vista pública, PDF y lectores
  anteriores. En canciones y timing solo se actualiza cantante/responsable.
- `GET /fichas/:id/people?search=` devuelve hasta 30 coincidencias activas con ID,
  nombre y campus. Requiere editar una sección de esa ficha; los editores locales
  buscan su campus y usuarios sin campus. Los editores con alcance global pueden
  buscar en todos. No requiere permisos del directorio administrativo.
- El servidor valida IDs, alcance, estructura y límites; obtiene el nombre canónico
  al vincular y conserva el nombre histórico cuando esa persona ya estaba vinculada.
- Clonar limpia asignaciones operativas. Copiar, eliminar o separar encuentros
  remapea valores e IDs conjuntamente. La vista pública omite los IDs.
- Se mantiene el control de revisión de sección y el historial; vincular a una persona
  no concede permisos, modifica cargos ni envía notificaciones nuevas.

## Límites de esta entrega

No se migra automáticamente texto antiguo ni se crea una tabla nueva: el modelo vive
junto a las filas en el JSON existente. Los nombres heredados se muestran como dato
anterior al abrir el selector, y el historial registra su sustitución explícita.
Los bloques siguen siendo fichas independientes; dentro de una ficha heredada con AM
 y PM el alcance usa la división existente a las 15:00. No incluye confirmación de
servicio, alertas de choques entre fichas ni una importación automática de los PDF.
Las horas discordantes de los PDF no se incorporan; no se añadió una validación nueva
de duración al editor de timing en esta entrega.

Las secciones siguientes conservan el análisis funcional de referencia.

## Objetivo

Separar el puesto operativo de la persona que lo cubre. Al seleccionar una persona
del directorio, guardar su ID y el nombre mostrado en esa edición de la ficha.
El puesto de una ficha no modifica el cargo organizacional ni los permisos del usuario.

Antes de esta entrega, `Row.values` contenía cadenas por encuentro; `PersonCellInput` buscaba
usuarios, pero su selección emitía `displayName(u)`, sin persistir el ID. Los
responsables de ficha y de sección sí tienen otro modelo de asignación por ID.
Se necesita un contrato específico para las personas de cada puesto; no basta
con cambiar el aspecto del buscador.

## Plantillas y alcance

La plantilla estándar toma Puente Alto como referencia para los demás campus,
con variantes configurables de día, horario y puestos; no se deben imponer sus
horarios a todos los campus.

| Referencia | Agrupación observada |
|---|---|
| Puente Alto, Jueves | Un encuentro a las 20:00 |
| Puente Alto, Domingo bloque I | Un encuentro a las 11:00 |
| Puente Alto, Domingo bloque II | Un encuentro a las 18:00 |
| Santiago, Miércoles global | Un encuentro a las 20:00 |
| Santiago, Domingo AM | Bloque con encuentros 09:00, 11:00 y 13:00; 11:00 marcado en vivo |
| Santiago, Domingo PM | Bloque con encuentros 17:00 y 19:00 |

Jerarquía propuesta: campus → ficha por fecha → bloques → encuentros.
Los equipos técnicos y de Worship pueden compartirse dentro de un bloque;
las personas de plataforma y el timing pueden variar por encuentro. Debe
permitirse una excepción explícita por encuentro sin modificar el otro bloque.
La estructura anterior ya distingue encuentros, pero `shared` no identifica un
bloque concreto. No reinterpretar automáticamente todos sus valores como compartidos.

## Secciones operativas

1. Plataforma: bienvenida y noticias, predicación, siembra/información/despedida.
2. Responsables: productor general, responsable técnico del campus y productor del bloque/encuentro.
3. Streaming: director/Wirecast y posiciones de cámara.
4. Técnica: sonido, asistencia de sonido, broadcast, iluminación, Arena, ProPresenter y stage.
5. Media: fotografía, edición, redes/historias y registro audiovisual.
6. Información especial: mensajes de bienvenida y despedida, con enlaces y notas.
7. Worship: armonía vocal, VIO, voces, instrumentos y posiciones de escena.
8. Programa: canciones, tonalidades, personas que dirigen y momentos intercalados.
9. Timing: preparación del bloque y desarrollo de cada encuentro.

Conservar el reordenamiento de filas, las posiciones de escena y los módulos
actuales. Las plantillas definen la base, sin impedir adaptar un campus.

## Selector de personas

- Escribir parte del nombre y seleccionar un usuario existente.
- Buscar sin depender de tildes, con nombre completo y campus para distinguir homónimos.
- Priorizar personas del campus. La consulta de otros campus debe respetar los
  permisos y las necesidades de los equipos compartidos.
- Mostrar disponibilidad registrada para el período y distinguirla de una
  confirmación efectiva de servicio; una no implica la otra.
- Permitir una o varias personas en el mismo puesto y quitar una sin borrar las demás.
- Mantener observaciones separadas del nombre: suplencias, formación y notas.
- No crear cuentas por escribir texto ni enlazar automáticamente por coincidencia
  aproximada. Los nombres antiguos sin vínculo se muestran como pendientes de vincular.
- No usar el endpoint administrativo de usuarios como requisito para asignar:
  ofrecer una búsqueda mínima autorizada desde la ficha, sin datos privados de cuenta.

## Casillas que no representan usuarios

“Fija”, “Secuencia”, “Por confirmar”, “Por cubrir”, “No aplica” y un guion no son
personas. Deben modelarse como estado o recurso, con observaciones cuando haga falta.
“Equipo Santiago” y “Pastores principales” son referencias colectivas que necesitan
resolverse en un equipo o en personas concretas; no crear usuarios con esos nombres.
Abreviaturas, apodos y marcas como `(c)` deben conservarse como fuente hasta confirmar
su significado; no inferir identidades ni roles automáticamente.

## Persistencia propuesta

Cada asignación necesita: puesto estable, ámbito (bloque o encuentro), lista de
usuarios por ID, nombres conservados para la ficha histórica, estado operativo y
observaciones. Guardar el texto anterior como referencia durante la migración.
Validar en el servidor usuarios existentes, acceso al campus/ficha y revisión de
sección para evitar sobrescribir la edición simultánea de otra persona.

Asignar a una persona como músico, cámara o predicador no debe darle permisos de
edición ni administración. Las reglas de acceso a la ficha siguen siendo explícitas.

## Migración y aceptación

1. Incorporar el modelo compatible con fichas existentes y el selector por ID.
2. Aplicarlo a puestos, posiciones de escena, VIO y responsables de canciones.
3. Añadir bloques y las plantillas basadas en estos PDF.
4. Preparar una previsualización de correspondencias de nombres; no asignar por apodos.
5. Migrar solo correspondencias validadas, conservar el original y registrar cambios.
6. Verificar edición, lectura, vista pública, PDF, clonación y permisos.

Casos esenciales: dos personas por puesto; homónimos; usuario inactivo; nombre
antiguo sin vínculo; cámara fija; puesto pendiente; asignación compartida en AM
con excepción a las 11:00; PM independiente; conservación de fichas históricas.

Los horarios de los PDF contienen algunas duraciones discordantes e intervalos
que terminan antes de comenzar. La plantilla debe detectar esas inconsistencias
y pedir corregirlas, sin copiar errores ni inventar horarios definitivos.
