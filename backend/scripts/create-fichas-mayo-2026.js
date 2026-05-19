/**
 * Crea las fichas de Mayo 2026 en Firestore a partir de los PDFs de producción.
 * Uso: node scripts/create-fichas-mayo-2026.js
 */
require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const path  = require('path');

const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
admin.initializeApp({ credential: admin.credential.cert(keyFile), projectId: process.env.FIREBASE_PROJECT_ID });
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

const now = () => admin.firestore.FieldValue.serverTimestamp();
const ts  = (d) => admin.firestore.Timestamp.fromDate(new Date(d));
const sv  = (v) => ({ shared: v || '' });           // shared row value
const uv  = (v) => ({ unico:  v || '' });           // unico encounter value
const mv  = (obj) => obj;                            // multi encounter values

function sec(rows, completed = true) {
  return { assignedTo: null, assignedName: null, isCompleted: completed,
           completedBy: 1, completedAt: now(), rows };
}
const r = (id, label, type, shared, values, order, required = false) =>
  ({ id, label, type, shared, values, order, required });

// ── Secciones por defecto rellenas ────────────────────────────────────────────

function pastoral_unico(bienvenida, predicacion, siembra, despedida) {
  return sec([
    r('p1','Bienvenida',         'person', false, uv(bienvenida),  0, true),
    r('p2','Predicación',         'person', false, uv(predicacion), 1, true),
    r('p3','Siembra',             'person', false, uv(siembra),    2),
    r('p4','Despedida y Oración', 'person', false, uv(despedida),  3),
  ]);
}

function pastoral_multi(rows_data) {
  // rows_data: [{bienvenida, predicacion, siembra, despedida} per encounter]
  // builds values like { e1: '...', e2: '...', e3: '...' }
  const enc = Object.keys(rows_data[0]);
  return sec([
    r('p1','Bienvenida',         'person', false, Object.fromEntries(enc.map(k=>[k,rows_data[0][k]||''])), 0, true),
    r('p2','Predicación',         'person', false, Object.fromEntries(enc.map(k=>[k,rows_data[1][k]||''])), 1, true),
    r('p3','Siembra',             'person', false, Object.fromEntries(enc.map(k=>[k,rows_data[2][k]||''])), 2),
    r('p4','Despedida y Oración', 'person', false, Object.fromEntries(enc.map(k=>[k,rows_data[3][k]||''])), 3),
  ]);
}

function escena(vio, armonias, vox1, vox2, vox3, gtrMD, piano, bajo, bateria, izq='', centro='', der='') {
  return sec([
    r('esc1',  'VIO',                 'text',   true, sv(vio),      0),
    r('esc2',  'Encargado Armonías',  'person', true, sv(armonias), 1),
    r('esc3',  'Voz 1',              'person', true, sv(vox1),     2),
    r('esc4',  'Voz 2',              'person', true, sv(vox2),     3),
    r('esc5',  'Voz 3',              'person', true, sv(vox3),     4),
    r('esc6',  'Gtr Eléctrica / MD', 'person', true, sv(gtrMD),   5),
    r('esc7',  'Piano',              'person', true, sv(piano),    6),
    r('esc8',  'Bajo',               'person', true, sv(bajo),     7),
    r('esc9',  'Batería',            'person', true, sv(bateria),  8),
    r('esc10', 'Posición Izquierda', 'person', true, sv(izq),      9),
    r('esc11', 'Posición Centro',    'person', true, sv(centro),  10),
    r('esc12', 'Posición Derecha',   'person', true, sv(der),     11),
  ]);
}

function produccion(pg, tecnico, prod, sonido, asSonido, stage, ilum, visuales, proPres, broadcast, rrss, foto, reg, hist='') {
  return sec([
    r('pr1',  'Productor General',       'person', true, sv(pg),        0, true),
    r('pr2',  'Encargado Técnico',       'person', true, sv(tecnico),   1),
    r('pr3',  'Productor del Encuentro', 'person', true, sv(prod),      2, true),
    r('pr4',  'Sonido',                  'person', true, sv(sonido),    3, true),
    r('pr5',  'Asistente Sonido',        'person', true, sv(asSonido),  4),
    r('pr6',  'Stage',                   'person', true, sv(stage),     5),
    r('pr7',  'Iluminación',             'person', true, sv(ilum),      6),
    r('pr8',  'Visuales',               'person', true, sv(visuales),  7),
    r('pr9',  'ProPresenter',            'person', true, sv(proPres),   8),
    r('pr10', 'Broadcast',              'person', true, sv(broadcast), 9),
    r('pr11', 'RRSS',                   'person', true, sv(rrss),      10),
    r('pr12', 'Fotografía y Edición',   'person', true, sv(foto),      11),
    r('pr13', 'Registro Audiovisual',   'person', true, sv(reg),       12),
    r('pr14', 'Historias',              'person', true, sv(hist),      13),
  ]);
}

function streaming(dir, cam1, cam2, cam3, cam4) {
  return sec([
    r('st1','Director / Wirecast','person', true, sv(dir),  0, true),
    r('st2','Cam 1',              'person', true, sv(cam1), 1),
    r('st3','Cam 2',              'person', true, sv(cam2), 2),
    r('st4','Cam 3 / Pluma',      'person', true, sv(cam3), 3),
    r('st5','Cam 4 / Móvil',      'person', true, sv(cam4), 4),
  ]);
}

function setList_unico(canciones) {
  // canciones: array de strings
  const labels = ['Canción 1','Canción 2','Canción 3','Canción 4','Canción 5','Canción 6'];
  return sec(labels.map((lbl,i) =>
    r(`sl${i+1}`, lbl, 'song', false, uv(canciones[i]||''), i)
  ));
}

function setList_shared(canciones) {
  const labels = ['Canción 1','Canción 2','Canción 3','Canción 4','Canción 5','Canción 6'];
  return sec(labels.map((lbl,i) =>
    r(`sl${i+1}`, lbl, 'song', true, sv(canciones[i]||''), i)
  ));
}

function horarios_unico(preparacion, apertura, ensayo, inicio, worship, predicacion, respuesta, cierre) {
  return sec([
    r('h1','Preparación sala',    'text', true,  sv(preparacion), 0),
    r('h2','Apertura puertas',    'text', false, uv(apertura),    1),
    r('h3','Ensayo',              'text', false, uv(ensayo),      2),
    r('h4','Inicio Encuentro',    'text', false, uv(inicio),      3),
    r('h5','Inicio Worship',      'text', false, uv(worship),     4),
    r('h6','Predicación',         'text', false, uv(predicacion), 5),
    r('h7','Tiempo de Respuesta', 'text', false, uv(respuesta),   6),
    r('h8','Cierre / Despedida',  'text', false, uv(cierre),      7),
  ]);
}

function anuncios(bienvenida, d1, d2='', d3='', proximo='') {
  return sec([
    r('an1','Info Bienvenida',  'text', true, sv(bienvenida), 0),
    r('an2','Info Despedida 1', 'text', true, sv(d1),         1),
    r('an3','Info Despedida 2', 'text', true, sv(d2),         2),
    r('an4','Info Despedida 3', 'text', true, sv(d3),         3),
    r('an5','Próximo evento',   'text', true, sv(proximo),    4),
  ]);
}

function voluntarios(encargado, c1='', c2='', arKids='', arTweens='', cafe='', ingreso='', auditorio='', siembra='', bebes='') {
  return sec([
    r('v1',  'Encargado',         'person', true, sv(encargado), 0),
    r('v2',  'Carteles 1',        'person', true, sv(c1),        1),
    r('v3',  'Carteles 2',        'person', true, sv(c2),        2),
    r('v4',  'AR Kids',           'person', true, sv(arKids),    3),
    r('v5',  'AR Tweens',         'person', true, sv(arTweens),  4),
    r('v6',  'Cafetería',         'person', true, sv(cafe),      5),
    r('v7',  'Ingreso Auditorio', 'person', true, sv(ingreso),   6),
    r('v8',  'Auditorio',         'person', true, sv(auditorio), 7),
    r('v9',  'Siembra',           'person', true, sv(siembra),   8),
    r('v10', 'Sala bebés',        'person', true, sv(bebes),     9),
  ]);
}

// Sections para tipo oracion
function oracion_pastoral(o1, o2, o3) {
  return sec([
    r('or_p1','Orador 1','person', true, sv(o1), 0, true),
    r('or_p2','Orador 2','person', true, sv(o2), 1),
    r('or_p3','Orador 3','person', true, sv(o3), 2),
  ]);
}
function oracion_escena(voxGtr, voxPiano, gtrMD) {
  return sec([
    r('or_e1','Vox / Gtr',   'person', true, sv(voxGtr),   0),
    r('or_e2','Vox / Piano', 'person', true, sv(voxPiano), 1),
    r('or_e3','Gtr / MD',    'person', true, sv(gtrMD),    2),
  ]);
}
function oracion_produccion(prodResp, prod, sala, asSon, broadcast, stage, visPro, visArena, hist='', ilum='', reg='', foto='') {
  return sec([
    r('or_pr1',  'Prod. Responsable',     'person', true, sv(prodResp),  0, true),
    r('or_pr2',  'Productor',             'person', true, sv(prod),      1),
    r('or_pr3',  'Sala',                  'person', true, sv(sala),      2),
    r('or_pr4',  'Asist. Sonido',         'person', true, sv(asSon),     3),
    r('or_pr5',  'Broadcast',             'person', true, sv(broadcast), 4),
    r('or_pr6',  'Stage',                 'person', true, sv(stage),     5),
    r('or_pr7',  'Visual / ProPresenter', 'person', true, sv(visPro),    6),
    r('or_pr8',  'Visual / Arena',        'person', true, sv(visArena),  7),
    r('or_pr9',  'Historias',             'person', true, sv(hist),      8),
    r('or_pr10', 'Iluminación',           'person', true, sv(ilum),      9),
    r('or_pr11', 'Registro',              'person', true, sv(reg),      10),
    r('or_pr12', 'Fotografía',            'person', true, sv(foto),     11),
  ]);
}
function oracion_streaming(resp, dirTV, cam1, cam2, cam3, cam4Mobile) {
  return sec([
    r('or_st1','Responsable',   'person', true, sv(resp),       0, true),
    r('or_st2','Dir. TV',       'person', true, sv(dirTV),      1),
    r('or_st3','Cam 1',         'person', true, sv(cam1),       2),
    r('or_st4','Cam 2',         'person', true, sv(cam2),       3),
    r('or_st5','Cam 3',         'person', true, sv(cam3),       4),
    r('or_st6','Cam 4 (Móvil)', 'person', true, sv(cam4Mobile), 5),
  ]);
}
function oracion_setList(bienvenida, gratitud, testimonios, pet1, pet2, oracion1, oracion2) {
  return sec([
    r('or_sl1','Bienvenida — Canción',           'song', true, sv(bienvenida),  0),
    r('or_sl2','Gratitud — Canción',             'song', true, sv(gratitud),    1),
    r('or_sl3','Testimonios — Canción',          'song', true, sv(testimonios), 2),
    r('or_sl4','Peticiones — Canción 1',         'song', true, sv(pet1),        3),
    r('or_sl5','Peticiones — Canción 2',         'song', true, sv(pet2),        4),
    r('or_sl6','Oración Presencial — Canción 1', 'song', true, sv(oracion1),    5),
    r('or_sl7','Oración Presencial — Canción 2', 'song', true, sv(oracion2),    6),
  ]);
}
function oracion_horarios(bienvenidaPastor, gratitudPastor, testimoniosPastor, peticionPastor, oracionPastor, despedidaPastor) {
  return sec([
    r('or_h1',  '05:00 — Llegada de Equipo',              'text',   true, sv('Voluntarios · ARW · Equipo técnico'), 0),
    r('or_h2',  '05:10-05:40 — Preparativos',             'text',   true, sv('Ensambles · Prueba · Montaje áreas'),  1),
    r('or_h3',  '05:25-05:35 — Link de Prueba',           'text',   true, sv('Transmisión · Sonido'),               2),
    r('or_h4',  '05:40-05:50 — VIO (Tiempo de ajustes)',  'text',   true, sv('Información Final Precisa'),          3),
    r('or_h5',  '05:55 — Ingreso Auditorio',              'text',   true, sv(''),                                   4),
    r('or_h6',  '06:00 — Counter',                        'text',   true, sv(''),                                   5),
    r('or_h7',  '06:05-06:08 — Bienvenida',               'person', true, sv(bienvenidaPastor),                     6),
    r('or_h8',  '06:12-06:17 — Gratitud',                 'person', true, sv(gratitudPastor),                       7),
    r('or_h9',  '06:20-06:26 — Testimonios',              'person', true, sv(testimoniosPastor),                    8),
    r('or_h10', '06:29-06:40 — Peticiones Campus Virtual','person', true, sv(peticionPastor),                       9),
    r('or_h11', '06:43-06:55 — Oración Peticiones',       'person', true, sv(oracionPastor),                       10),
    r('or_h12', '07:00 — Despedida y Agradecimiento',     'person', true, sv(despedidaPastor),                     11),
  ]);
}

const COMP_ORACION  = { pastoral:true, escena:true, produccion:true, streaming:true, setList:true, horarios:true };
const COMP_REGULAR  = { pastoral:true, escena:true, produccion:true, streaming:true, setList:true, horarios:true, anuncios:true, voluntarios:true };

// ── Definición de fichas ──────────────────────────────────────────────────────

const FICHAS = [

  // ── 1. Encuentro Oración — 13.05.2026 ──────────────────────────────────────
  {
    campusId:   'campus-santiago',
    campusName: 'Campus Santiago',
    type:       'oracion',
    title:      'Encuentro Oración | Miércoles 13.05.2026',
    date:       '2026-05-13',
    encuentros: [{ id:'unico', label:'Encuentro Oración · 6:00 am', time:'06:00', isLive:true, color:'#6366f1' }],
    sections: {
      pastoral:   oracion_pastoral('Pastor Patricio Andres Burgos', 'Pastora Evelin Fuentes', 'Pastor Rodrigo Quiroz'),
      escena:     oracion_escena('Ps. Fran Henriquez', 'Ps. Rodrigo Quiroz', 'Ps. Pablo Encina'),
      produccion: oracion_produccion('Josué Ferrer','Min. Cesar Osses','Abi Pereira','Min. Darwin Vargas','Benjamin Saavedra','Franklin Guzman','Bayron Gonzalez','Bayron Gonzalez','','Ruben Albornoz','','Min. Aileen Gonzalez'),
      streaming:  oracion_streaming('Min. César Osses','Carlos Villalobos / Jonathan Molina','Jose Luis Castro','','Jose Espinoza','Dania Torres'),
      setList:    oracion_setList('Jesús en el Centro (G) - Ps. Rodrigo y equipo','En tu presencia (G) - Ps. Fran y equipo','Al que está sentado (G) - Ps. Rodrigo y equipo','No hay otro nombre (G) - Ps. Fran y equipo','King of Kings (C) - Ps. Rodrigo y equipo','Tu Fidelidad (G) - Ps. Fran y equipo','Ya no soy esclavo (G) - Ps. Rodrigo y equipo'),
      horarios:   oracion_horarios('Ps. Evelin Fuentes','Ps. Evelin Fuentes','Ps. Rodrigo Quiroz','Ps. Rodrigo Quiroz','Pastor Patricio Andres Burgos','Pastores Patricio Andres y Evelin'),
    },
    completionStatus: COMP_ORACION,
  },

  // ── 2. ARM La Plata — 10.05.2026 ───────────────────────────────────────────
  {
    campusId:   'arm-la-plata',
    campusName: 'ARM La Plata',
    type:       'unico',
    title:      'Encuentro ARM La Plata | Domingo 10.05.2026',
    date:       '2026-05-10',
    encuentros: [{ id:'unico', label:'Encuentro · 11:00 am', time:'11:00', isLive:false, color:'#10b981' }],
    sections: {
      pastoral:   pastoral_unico('Pastorita Patricia Alarcón','Pastor Principal Patricio Burgos','Pastor Daniel Villalba','Pastores Principales'),
      escena:     escena('Pablo y Cami','','Camila Villalba','','','Pablo Seguismondi','','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','','Ps. Daniel Villalba','','','Jesus','','Pedro Lameda / Jose Luis','','','Ps. Paola Ortiz / Dionnay','Ps. Pao Ortiz','',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['Glorioso dia (G) - Cami y equipo','Entra ante sus puertas (D) - Cami y equipo','Fresh wind (C) - Cami y equipo','Miles de Aleluyas (C) - Cami y equipo','King of king (D) - Cami y equipo','Socorro (D) - Cami y equipo']),
      horarios:   horarios_unico('9:00 — Llegada del Equipo','10:55','9:00–9:45 — Montaje y Preparación (Técnica · ARW · Voluntarios)','11:00','11:05 — AR Worship (10 min)','11:32 — Predicación (40 min)','12:17 — Siembra (05 min)','12:22 — Despedida / 12:40 AR Worship'),
      anuncios:   anuncios('VIDA PANORAMICA | Grupos Pequeños — Se parte de nuestra gran temporada','Encuentro Oración Miércoles — 7:00 am Campus Virtual','Miércoles Global 9:00 pm · Campus Virtual','Domingo 12:00 hrs · Campus Virtual',''),
      voluntarios: voluntarios('Pastores Daniel Villalba y Paola Ortiz','Edixa','Daniela','Paulimar','','Yolanda - Andrea','Ps. Daniel Villalba','Fabiola','Pedro Lameda',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 3. Campus Concepción — 16.05.2026 ──────────────────────────────────────
  {
    campusId:   'campus-concepcion',
    campusName: 'Campus Concepción',
    type:       'unico',
    title:      'Encuentro Campus Concepción | Sábado 16.05.2026',
    date:       '2026-05-16',
    encuentros: [{ id:'unico', label:'Encuentro · 5:30 pm', time:'17:30', isLive:false, color:'#f59e0b' }],
    sections: {
      pastoral:   pastoral_unico('Min. Luis Ramirez','Min. Luis Ramirez','Rebeca Romero','Min. Luis Ramirez'),
      escena:     escena('Samuel y Rebeca','Rebeca Romero','Rebeca Romero','Jacqueline Neira','','Samuel Montalva','Felipe Escobar','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Abi Ahumada','','Andrés Zamorano','','Marco Díaz','','Abi Ahumada / Juan Guzmán (C)','','','Pauli Vásquez','Fernanda Sandoval','',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['Amor profundo (G) - Samuel y equipo','La pasion (D) - Rebeca y equipo','Victoria si no abandonas (D) - Samuel y equipo','More than Able (D) - Samuel, Rebeca y equipo','Por la Fe (C) - Samuel y equipo','Socorro (C) - Rebeca y equipo']),
      horarios:   horarios_unico('15:00 — Llegada del Equipo','17:25','15:00–16:00 — Montaje y Preparación (TÉCNICA + ARW)','17:30','17:35 — AR Worship (20 min)','17:55 — Bienvenida y Predicación (40 min)','18:40 — Siembra (05 min)','18:55 — AR Worship (05 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal','Grupos Pequeños — Ya comenzamos nuestra gran temporada','Heroes Kids & Tweens','Encuentro Domingo: Campus Virtual 11 am (Chile)','Miércoles Global: Encuentro Oración 6am / Encuentro 8:00 pm'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 4. Campus Maracaibo Bloque I — 17.05.2026 ──────────────────────────────
  {
    campusId:   'campus-maracaibo',
    campusName: 'Campus Maracaibo',
    type:       'unico',
    title:      'Encuentro Campus Maracaibo Bloque I | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque I · 11:00 am', time:'11:00', isLive:false, color:'#8b5cf6' }],
    sections: {
      pastoral:   pastoral_unico('Pastora Prila Fabio','Pastora Prila Fabio','Ministro Orlando Valbuena','Pastora Prila Fabio'),
      escena:     escena('Mai y Anderson','','Mai Villamizar','Anderson León','','Jonathan Correa','Rafael Perez','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Andrea Pernia','','Ruben Briceño','Earl Laguna','Santi Fernandez / Jonathan','','Andrea Pernia','','','Maria Victoria','Samy Moreno','Esthefany Montilla',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['Amor profundo (C) - Mai y equipo','Tumbas a Jardines (G) - Anderson y equipo','Quien mas (G) - Mai y equipo','Mi esperanza esta en Jesus (G) - Mai y equipo','Por la Fe (C) - Mai, Anderson y equipo','Socorro (C) - Mai y equipo']),
      horarios:   horarios_unico('9:00 — Llegada','11:00','9:00–9:40 — Montaje y preparación','11:02 — Counter (05 min)','11:08 — AR Worship (20 min)','11:33 — Predicación (40 min)','12:15 — Siembra (05 min)','12:20 — Despedida y Oración (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Pastor · Miércoles Global','Siembra en Casa / Cada Domingo / Kilo de Amor','Grupos Pequeños 2026 / Heroes Kids & Tweens','Miércoles Global: Encuentro Oración 6am · tarde 8pm','Encuentros próximo Domingo / 11 am y 6 pm'),
      voluntarios: voluntarios('Min. Orlando Valbuena / Min. Geo Vega / Min. Yelimar Gonzalez','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 5. Campus Maracaibo Bloque II — 17.05.2026 ─────────────────────────────
  {
    campusId:   'campus-maracaibo',
    campusName: 'Campus Maracaibo',
    type:       'unico',
    title:      'Encuentro Campus Maracaibo Bloque II | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque II · 6:00 pm', time:'18:00', isLive:false, color:'#ec4899' }],
    sections: {
      pastoral:   pastoral_unico('Pastora Prila Fabio','Pastora Prila Fabio','Nery Rosales','Pastora Prila Fabio'),
      escena:     escena('Mai y Anderson','','Jose Rafael Perez','Joaquin Briceño','','Jonathan Correa','Rafael Perez','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Andrea Pernia','','Earl Laguna','Mateo Quiroz','Santiago Fernandez','','Daniela Cuartin','','','Sofia Briceño','Andrea Pernia','Maga Briceño',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['Amor profundo (G) - Jose, Joaquin y equipo','Tumbas a Jardines (G) - Jose y equipo','Alabare al Señor (C) - Jose y equipo','Victoria (C) - Jose y equipo','Trust in God (C) - Jose y equipo','Praise (G) - Joaquin y equipo']),
      horarios:   horarios_unico('4:00 — Llegada','5:57','4:00–4:30 — Ajustes ARW y Técnica','6:02 — Counter (05 min)','6:08 — AR Worship (20 min)','6:33 — Predicación (40 min)','7:15 — Siembra (05 min)','7:20 — Avisos - Despedida'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Pastor · Miércoles Global','Siembra en Casa / Cada Domingo / Kilo de Amor','Grupos Pequeños 2026 / Heroes Kids & Tweens','Miércoles Global: Encuentro Oración 6am · tarde 8pm','Encuentros próximo Domingo / 11 am y 6 pm'),
      voluntarios: voluntarios('Min. Orlando Valbuena / Min. Carlos Labarca / Min. Jammary Luzardo','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 6. Campus Punta Arenas Bloque I — 17.05.2026 ───────────────────────────
  {
    campusId:   'campus-punta-arenas',
    campusName: 'Campus Punta Arenas',
    type:       'unico',
    title:      'Encuentro Campus Punta Arenas Bloque I | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque I · 11:00', time:'11:00', isLive:false, color:'#14b8a6' }],
    sections: {
      pastoral:   pastoral_unico('Min. Newman Guevara','Min. Newman Guevara','Min. Emelyn Barazarte','Ministros Newman y Emelyn'),
      escena:     escena('Javier Rosas','','Rachel Zamorano','Rut Perez','','Javier Rosas','Albenis Perozo','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Pedro Camargo - Min. Newman Guevara','Kevin Sanchez','Pedro Morales','','Matias Quezada','Islander Burgos','Yanire Goyoneche-Priscila M.','','','','Kathia Martinez','Pedro Camargo-Jennifer','Ana Gabriela'),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['El gozo de Dios (C) - Javier y equipo','La pasion (D) - Rut y equipo','Victoria si no abandonas (D) - Javier y equipo','More than Able (D) - Javier, Rut y equipo','Por la Fe (C) - Rut y equipo','Socorro (C) - Rachel y equipo']),
      horarios:   horarios_unico('9:00 — Llegada','10:55','9:00–9:40 — Montaje y preparación / Prueba ARW','11:00 — Counter (05 min)','11:00 — AR Worship (15 min)','11:20 — Predicación (40 min)','12:05 — Siembra (05 min)','12:10 — Presentacion de Bebés · Despedida y Oración Final'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Grupos Pequeños — Ya comenzamos nuestra gran temporada','Heroes Kids & Tweens','Encuentro presencial prox. Jueves 7:30 pm',''),
      voluntarios: voluntarios('Ps. Mariana Varela','Marrio Villegas - Nicol Oyarzo','Gladis Fernandez','Dayana-Monse-Sofia','Maria Gabriela','Gladis Fernandez - Nicol Oyarzo','Paula Vargas - Jorge Toledo','Mario Villegas','Osvaldo Vasquez - Laura Lopez',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 7. Campus Punta Arenas Bloque II — 17.05.2026 ──────────────────────────
  {
    campusId:   'campus-punta-arenas',
    campusName: 'Campus Punta Arenas',
    type:       'unico',
    title:      'Encuentro Campus Punta Arenas Bloque II | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque II · 18:00', time:'18:00', isLive:false, color:'#0ea5e9' }],
    sections: {
      pastoral:   pastoral_unico('Cristian Ruiz','Cristian Ruiz','Min. Newman Guevara','Ministros Newman y Emelyn'),
      escena:     escena('Javier Rosas','','Marly Chavez','Jeremy Salazar','','Javier Rosas','Albenis Perozo','','','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Pedro Camargo - Min. Newman Guevara','Min. Newman Guevara','Kevin Sanchez','Camilo Machado','Daniel Montilla','Daniel Montilla','Daniela Martinez','Carla Salfate','Pedro Camargo - Jennifer Rubio','','','',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['El gozo de Dios (C) - Javier y equipo','La pasion (D) - Marly y equipo','Victoria si no abandonas (D) - Javier y equipo','More than Able (D) - Javier, Marly y equipo','Por la Fe (C) - Marly y equipo','Socorro (C) - Marly y equipo']),
      horarios:   horarios_unico('4:00 — Llegada','5:20','4:00–4:40 — Montaje y preparación / Prueba ARW','6:00 — Counter (05 min)','6:05 — AR Worship (15 min)','6:25 — Predicación (40 min)','7:10 — Siembra (05 min)','7:15 — Despedida y Oración Final (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Grupos Pequeños — Ya comenzamos nuestra gran temporada','Heroes Kids & Tweens','Encuentro presencial prox. Jueves 7:30 pm',''),
      voluntarios: voluntarios('Ps. Mariana Varela','Marrio Villegas - Nicol Oyarzo','Magaly Bravo','Cinthya-Rachel-Valeria-Pas.Mariana','Genesis','Magaly Bravo - Sara Rodriguez','Ana Varela - Nicol Oyarzo','Luis Chavez','Mario Villegas - Paula Vargas',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 8. Campus Montevideo Bloque I — 17.05.2026 ─────────────────────────────
  {
    campusId:   'campus-montevideo',
    campusName: 'Campus Montevideo',
    type:       'unico',
    title:      'Encuentro Campus Montevideo Bloque I | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque I · 11:00', time:'11:00', isLive:false, color:'#3b82f6' }],
    sections: {
      pastoral:   pastoral_unico('Pastor Principal','Pastor Principal','Min. Lucresia Savio','Pastores Principales'),
      escena:     escena('Pablo y Keshya','Pablo Ortiz','Keshya Rodriguez','Ps. Paola Ortiz','Alejandra Rojas','Pablo Ortiz','Israel Videla','Ezequil Cardenas','Benjamin Ortiz','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Alejandro Montero','Alejandro Montero','Santiago Maldonado','Mathias Villalba','Emanuel Costa','Belen Arbalo','','Lucas Montero','','','Kimberli Planas / Maia Braceiro','Annavaleria Casadiego','Sara Montero'),
      streaming:  streaming('Oswar Ortega','','','',''),
      setList:    setList_unico(['El gozo de Dios (E) - Ps. Pao y equipo','Praise (B) - Keshya y equipo','Es Él (A) - Ps. Rodrigo, Ps. Pao y equipo','Siempre a tiempo (A) - Ps. Rodrigo y equipo','Por la Fe (C) - Keshya y equipo','See the light (G) - Pablo y equipo']),
      horarios:   horarios_unico('9:00 — Llegada','10:50','9:15–9:45 — Prueba y Montajes ARW','11:00 — Counter (05 min)','11:00 — AR Worship (15 min)','11:20 — Predicación (40 min)','12:05 — Siembra (05 min)','12:10 — Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Pastor · Miércoles Global','Heroes Kids & Tweens','Grupos Pequeños — Gran temporada','Miércoles Global: Encuentro Oración 7am / 9pm','Encuentro del Jueves en casa / 8pm'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 9. Campus Montevideo Bloque II — 17.05.2026 ────────────────────────────
  {
    campusId:   'campus-montevideo',
    campusName: 'Campus Montevideo',
    type:       'unico',
    title:      'Encuentro Campus Montevideo Bloque II | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque II · 18:00', time:'18:00', isLive:false, color:'#6366f1' }],
    sections: {
      pastoral:   pastoral_unico('Pastorita Patricia Alarcón','Pastorita Patricia Alarcón','Ps. Rodrigo Quiroz','Pastores Principales'),
      escena:     escena('Pablo y Nazarena','Pablo Ortiz','Keshya Rodriguez','Nazarena Videla','Isabella Paredes','Pablo Ortiz','Israel Videla','Ezequil Cardenas','Nicolas de León','','',''),
      produccion: produccion('Ps. Rodrigo Quiroz','Alejandro Montero','Lucrecia Sabio','Mathias Villalba','Santiago Maldonado','Emanuel Costa','Lucas Montero','','Alice Pauth','','','Maia Braceiro','Sara Montero','Donella San Martin'),
      streaming:  streaming('Oswar Ortega','','','',''),
      setList:    setList_unico(['El gozo de Dios (E) - Nazarena y equipo','Praise (B) - Keshya y equipo','Es Él (A) - Pablo y equipo','Siempre a tiempo (A) - Pablo y equipo','Por la Fe (C) - Keshya y equipo','See the light (G) - Pablo y equipo']),
      horarios:   horarios_unico('16:00 — Llegada','17:50','16:45–17:20 — Prueba y Montajes ARW','18:00 — Counter (05 min)','18:00 — AR Worship (15 min)','18:20 — Predicación (50 min)','19:15 — Siembra (05 min)','19:20 — Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Pastor · Miércoles Global','Heroes Kids & Tweens','Grupos Pequeños — Gran temporada','Miércoles Global: Encuentro Oración 7am / 9pm','Encuentro del Jueves en casa / 8pm'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 10. Campus Katy (Texas) — 17.05.2026 ───────────────────────────────────
  {
    campusId:   'campus-katy',
    campusName: 'Campus Katy',
    type:       'unico',
    title:      'Encuentro Campus Katy | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Encuentro · 11:30 am', time:'11:30', isLive:false, color:'#f97316' }],
    sections: {
      pastoral:   pastoral_unico('Pastora Kari Peralta','Pastora Kari Peralta','Pastor Jus Alvarez','Pastores Jus y Kari'),
      escena:     escena('Pres. Jus y Kari','','Betty Hinojosa','Carolina Mendoza','Maria Valentina','','','','','','',''),
      produccion: produccion('Ps. Nicolas Burgos','','Ann Sthevens','Gabriel Ceñas','Elvis Garcia','Gabriel Cenas','','Elvis Garcia','','','Maria Victoria','','',''),
      streaming:  streaming('','','','',''),
      setList:    setList_unico(['Freedom (G) - Betty y equipo','Me basta tu gran amor (D) - Carolina y equipo','King of king (D) - Maria Valentina y equipo','Bueno eres tu (D) - Betty y equipo','I Speak Jesus (D) - Carolina y equipo','']),
      horarios:   horarios_unico('10:00 — Llegada','11:28','10:00–10:45 — Preparacion y Montaje','11:30 — Counter','11:35 — ARW (20 min)','11:55 — Predicacion (40 min)','12:40 — Siembra (05 min)','12:45 — Despedida y Oracion (15 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Pastor · Miércoles Global','ADN arm Katy — Sábado 30.05 · 6pm Jornada presencial','Heroes Kids & Tweens','Grupos Pequeños 2026','Miércoles Global / Oracion 5:00 am - 7:00 pm Campus virtual'),
      voluntarios: voluntarios('Mafer Casadiego','','','Lily','Voluntario','Rina Fornasier','Pres. Jus y Kari / Frank Fornasier','Frank Fornasier','Maria Gabriela / Mafer Casadiego','Mafer Casadiego'),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 11. Campus Puente Alto Bloque I — 17.05.2026 ───────────────────────────
  {
    campusId:   'campus-puente-alto',
    campusName: 'Campus Puente Alto',
    type:       'unico',
    title:      'Encuentro Campus Puente Alto Bloque I | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque I · 11:00', time:'11:00', isLive:false, color:'#a855f7' }],
    sections: {
      pastoral:   pastoral_unico('Pastora Evelin Fuentes','Pastora Evelin Fuentes','Pastores Pablo y Naty','Pastores Pablo y Naty'),
      escena:     escena('Juan Jose y Jose','Juan Jose','Danae Hidalgo','Cami Letelier','Jose Sepulveda','Juan Jose Gonzalez','Rodrigo Tobar','Ismael Gonzalez','Rodrigo Flores','Jose','Juan Jose','Cami'),
      produccion: produccion('Ps. Rodrigo Quiroz','Ministros Katherine Gutiérrez & Carlos Contreras','Min. Katherine Gutiérrez / Sofía Domínguez (C)','Cristian Carrasco','Javier Encina / Sofía Rodriguez','Alex Añez','Joenny Villalobos','Karolina Cepeda','Abdias Garrido / Cami Rojas(C)','','Danynca Contreras','Edith A / Oscarino Rivera(C)','Emi Bustamante',''),
      streaming:  streaming('Min. Carlos Contreras','Oscar Figueroa','Fija','Diego Vera',''),
      setList:    setList_unico(['El gozo de Dios (C) - Juan Jose, Jose y equipo','La pasion (D) - Cami y equipo','Victoria si no abandonas (D) - Juan Jose y equipo','More than Able (D) - Juan Jose, Danae y equipo','Por la Fe (C) - Danae y equipo','']),
      horarios:   horarios_unico('9:00 — Llegada','10:50','9:15–9:45 — Prueba y Montajes ARW','11:00 — Counter (05 min)','11:00 — AR Worship (17 min)','11:23 — Predicación (40 min)','12:05 — Siembra (05 min)','12:10 — Tiempo de Siembra y Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Experiencia Bienvenida — quienes vienen por primera vez','Domingo Encuentro pm · Sanidad y Ungimiento con Aceite','Girl\'s night — viernes 22.05 · 7:30pm · campus Puente Alto','Heroes Kids & Tweens · Miércoles Global'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 12. Campus Puente Alto Bloque II — 17.05.2026 ──────────────────────────
  {
    campusId:   'campus-puente-alto',
    campusName: 'Campus Puente Alto',
    type:       'unico',
    title:      'Encuentro Campus Puente Alto Bloque II | Domingo 17.05.2026',
    date:       '2026-05-17',
    encuentros: [{ id:'unico', label:'Bloque II · 18:00', time:'18:00', isLive:false, color:'#ec4899' }],
    sections: {
      pastoral:   pastoral_unico('Pastora Naty Segura','Pastora Naty Segura','Pastores Pablo y Naty','Pastores Pablo y Naty'),
      escena:     escena('Juan Jose y Jose','Juan Jose','Danae Hidalgo','Cami Letelier','Jose Sepulveda','Juan Jose Gonzalez','Rodrigo Tobar','Ismael Gonzalez','Rodrigo Flores','Jose','Juan Jose','Cami'),
      produccion: produccion('Ps. Rodrigo Quiroz','Ministros Katherine Gutiérrez & Carlos Contreras','Min. Nicole González / Damaris García (C)','Javer Encina / Esteban Caro(C)','','Alex Añez','Adriana Oliveros','Adriana Oliveros','Yael Fernández / Elías Carrasco(C)','Diandra Alvear / Ruben Perez(C)','Javi Burgos','Emi Bustamante / Daira González','Anahis Leñam',''),
      streaming:  streaming('Diandra Alvear / Ruben Perez(C)','Nathanael Muñoz','Fija','Fija',''),
      setList:    setList_unico(['El gozo de Dios (C) - Juan Jose, Jose y equipo','La pasion (D) - Cami y equipo','Victoria si no abandonas (D) - Juan Jose y equipo','More than Able (D) - Juan Jose, Danae y equipo','Por la Fe (C) - Danae y equipo','']),
      horarios:   horarios_unico('16:00 — Llegada','17:50','16:00–17:00 — Prueba y Montajes ARW','18:00 — Counter (05 min)','18:00 — AR Worship (17 min)','18:22 — Predicación (50 min)','19:17 — Siembra (05 min)','19:17 — Tiempo de Siembra y Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Experiencia Bienvenida — quienes vienen por primera vez','Girl\'s night — viernes 22.05 · 7:30pm · campus Puente Alto','Heroes Kids & Tweens','Miércoles Global: Encuentro Oración 6am / 8pm Chile'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 13. Campus Santiago Bloque I — 24.05.2026 ──────────────────────────────
  {
    campusId:   'campus-santiago',
    campusName: 'Campus Santiago',
    type:       'multi',
    title:      'Encuentro Campus Santiago Bloque I | Domingo 24.05.2026',
    date:       '2026-05-24',
    encuentros: [
      { id:'e1', label:'9:00',           time:'09:00', isLive:false, color:'#64748b' },
      { id:'e2', label:'11:00 (EN VIVO)',time:'11:00', isLive:true,  color:'#ef4444' },
      { id:'e3', label:'13:00',          time:'13:00', isLive:false, color:'#10b981' },
    ],
    sections: {
      pastoral: sec([
        r('p1','Bienvenida',         'person', false, { e1:'Pastora Catalina Mora',          e2:'Pastor Patricio Andrés Burgos', e3:'Pastor Miguel Gonzalez' },   0, true),
        r('p2','Predicación',         'person', false, { e1:'Pastora Catalina Mora',          e2:'Pastor Patricio Andrés Burgos', e3:'Pastor Miguel Gonzalez' },   1, true),
        r('p3','Siembra',             'person', false, { e1:'Pastor Miguel Gonzalez',         e2:'Pastor Francisco Henriquez',   e3:'Pastora Catalina Mora' },     2),
        r('p4','Despedida y Oración', 'person', false, { e1:'Ps. Patricio Andres Burgos',    e2:'Ps. Patricio Andres Burgos',   e3:'Ps. Patricio Andres Burgos' },3),
      ]),
      escena:     escena('Min. Benjamin Soto','Min. Benjamin Soto','Loreannys Hernandez','Min. Benjamin Soto','','Min. Jose Candia','Daniel Fabio','Josias Muñoz','Matias Hidalgo','','',''),
      produccion: produccion('Pastor Rodrigo Quiroz','Pastores Rodrigo y Prila','Sofia Ortiz','Abi Pereira / Benja Saavedra','Min. Darwin Vargas','Daniel Zarate','Priscila Farias','Ken Peña','Bayron Gonzalez','Benja Saavedra','','Chris Gonzalez / Angela Aguilar','Valeria Romero',''),
      streaming:  streaming('An Rosario - Hector Hernandez (C)','Edwin Mocada','Fija','Jose Gauna','Angelo Lemus'),
      setList:    setList_shared(['El gozo de Dios (C) - Min. Benja y equipo','La pasion (D) - Loreannys y equipo','Victoria si no abandonas (D) - Min. Benja y equipo','Por la Fe (C) - Loreannys y equipo','','']),
      horarios:   horarios_unico('7:15 — Llegada Voluntarios / Montaje y Preparación','8:55 / 10:50 / 12:55','7:30–8:40 — Prueba ARW · Transmisión','9:00 / 11:00 / 13:00 — Countdown (05 min)','9:05 — AR Worship (20 min)','9:30 — Predicación (35 min)','10:15 — Siembra (05 min)','10:20 — Siembra y Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Experiencia Bienvenida — quienes vienen por primera vez','Girl\'s night — viernes 22.05 · 7:30pm · campus Puente Alto','Grupos Pequeños — Gran temporada','Heroes Kids & Tweens · Miércoles Global: Encuentro Oración 6am / 8pm'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },

  // ── 14. Campus Santiago Bloque II — 24.05.2026 ─────────────────────────────
  {
    campusId:   'campus-santiago',
    campusName: 'Campus Santiago',
    type:       'multi',
    title:      'Encuentro Campus Santiago Bloque II | Domingo 24.05.2026',
    date:       '2026-05-24',
    encuentros: [
      { id:'e1', label:'17:00', time:'17:00', isLive:false, color:'#f59e0b' },
      { id:'e2', label:'19:00', time:'19:00', isLive:false, color:'#8b5cf6' },
    ],
    sections: {
      pastoral: sec([
        r('p1','Bienvenida',         'person', false, { e1:'Ps. Francisco Henriquez',   e2:'Pastor Patricio Andrés Burgos' }, 0, true),
        r('p2','Predicación',         'person', false, { e1:'Ps. Francisco Henriquez',   e2:'Pastor Patricio Andrés Burgos' }, 1, true),
        r('p3','Siembra',             'person', false, { e1:'Pastores Fran y Catalina', e2:'Pastor Fran y Catalina' },        2),
        r('p4','Despedida y Oración', 'person', false, { e1:'Pastores Fran y Catalina', e2:'Pastor Fran y Catalina' },        3),
      ]),
      escena:     escena('Chris Carreño','Min. Treicy','Min. Treicy Aceiton','Carolina San Martin','Chris Carreño','Chris Carreño','Marco Mella','Manu Cordova','Matias Bastias','Chris','Min. Treicy','Caro'),
      produccion: produccion('Ps. Rodrigo Quiroz','Pastores Rodrigo y Prila','Ken Peña','Deimer Guzman / Benja Saavedra','Luis Garcia','Deivy Marrufo','Jose Hernandez','Héctor Pirona','Bayron Gonzalez','','','Ale Rojas','Gaby Rojas',''),
      streaming:  streaming('Jonathan Molina - Marcos Hernandez (C)','Aldo Carrero','Fija','David Burgos',''),
      setList:    setList_shared(['El gozo de Dios (C) - Chris y equipo','La pasion (D) - Min. Treicy, Caro y equipo','Victoria si no abandonas (D) - Chris y equipo','Por la Fe (C) - Min. Treicy y equipo','','']),
      horarios:   horarios_unico('3:15 — Llegada / Pruebas y Preparación (ARW · Técnicos)','4:57 / 6:57','4:00–4:15 — VIO / 4:15–4:30 Check Técnico Final','5:00 / 7:00 — Countdown (5 min)','5:05 — AR Worship (20 min)','5:25 — Bienvenida y Reflexión (45 min)','6:10 — AR Worship (7 min) / Siembra','6:17 — Tiempo de Siembra y Despedida (10 min)'),
      anuncios:   anuncios('VIDA PANORAMICA — Nueva Serie del Ps. Principal · Miércoles Global','Experiencia Bienvenida — quienes vienen por primera vez','Girl\'s night — viernes 22.05 · 7:30pm · campus Puente Alto','Grupos Pequeños — Gran temporada','Heroes Kids & Tweens · Miércoles Global'),
      voluntarios: voluntarios('','','','','','','','','',''),
    },
    completionStatus: COMP_REGULAR,
  },
];

// ── Ejecutar ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nCreando ${FICHAS.length} fichas en Firestore...\n`);
  const batch = db.batch();

  for (const f of FICHAS) {
    const ref     = db.collection('fichas').doc();
    const fichaId = ref.id;
    const allCompleted = Object.values(f.completionStatus).every(Boolean);

    const doc = {
      fichaId,
      campusId:         f.campusId,
      campusName:       f.campusName,
      type:             f.type,
      title:            f.title,
      date:             ts(f.date),
      encuentros:       f.encuentros,
      sections:         f.sections,
      completionStatus: f.completionStatus,
      status:           allCompleted ? 'complete' : 'in_progress',
      createdBy:        1,
      createdByName:    'Sistema',
      createdAt:        now(),
      lastModifiedBy:   1,
      lastModifiedAt:   now(),
    };
    batch.set(ref, doc);
    console.log(`  ✓  ${f.title}`);
  }

  await batch.commit();
  console.log(`\n✅ ${FICHAS.length} fichas creadas exitosamente.\n`);
  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
