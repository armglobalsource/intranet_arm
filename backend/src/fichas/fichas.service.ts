import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateFichaDto, UpdateFichaDto, UpdateSectionDto, CloneFichaDto } from './dto/ficha.dto';

const COL = 'fichas';

const SECTIONS = [
  'pastoral', 'escena', 'produccion', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios',
] as const;
type SectionName = typeof SECTIONS[number];

// Secciones activas según tipo de ficha
const SECTIONS_ORACION: SectionName[] = ['pastoral', 'escena', 'produccion', 'streaming', 'setList', 'horarios'];
const SECTIONS_REGULAR: SectionName[] = ['pastoral', 'escena', 'produccion', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios'];

// ── Filas predeterminadas — Servicios regulares ───────────────────────────────

function defaultRows(section: SectionName): any[] {
  switch (section) {

    // ── Equipo Pastoral ────────────────────────────────────────────────────
    case 'pastoral':
      return [
        { id: 'p1', label: 'Bienvenida',          type: 'person', shared: false, values: {}, order: 0, required: true  },
        { id: 'p2', label: 'Predicación',          type: 'person', shared: false, values: {}, order: 1, required: true  },
        { id: 'p3', label: 'Siembra',              type: 'person', shared: false, values: {}, order: 2, required: false },
        { id: 'p4', label: 'Despedida y Oración',  type: 'person', shared: false, values: {}, order: 3, required: false },
      ];

    // ── AR Worship / Banda ─────────────────────────────────────────────────
    case 'escena':
      return [
        { id: 'esc1',  label: 'VIO',                  type: 'text',   shared: true, values: {}, order: 0,  required: false },
        { id: 'esc2',  label: 'Encargado Armonías',   type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'esc3',  label: 'Voz 1',               type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'esc4',  label: 'Voz 2',               type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'esc5',  label: 'Voz 3',               type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'esc6',  label: 'Gtr Eléctrica / MD',  type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'esc7',  label: 'Piano',               type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'esc8',  label: 'Bajo',                type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'esc9',  label: 'Batería',             type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'esc10', label: 'Posición Izquierda',  type: 'person', shared: true, values: {}, order: 9,  required: false },
        { id: 'esc11', label: 'Posición Centro',     type: 'person', shared: true, values: {}, order: 10, required: false },
        { id: 'esc12', label: 'Posición Derecha',    type: 'person', shared: true, values: {}, order: 11, required: false },
      ];

    // ── Producción ─────────────────────────────────────────────────────────
    case 'produccion':
      return [
        { id: 'pr1',  label: 'Productor General',        type: 'person', shared: true, values: { shared: 'Ps. Rodrigo Quiroz' }, order: 0,  required: true  },
        { id: 'pr2',  label: 'Encargado Técnico',        type: 'person', shared: true, values: {},                               order: 1,  required: false },
        { id: 'pr3',  label: 'Productor del Encuentro',  type: 'person', shared: true, values: {},                               order: 2,  required: true  },
        { id: 'pr4',  label: 'Sonido',                   type: 'person', shared: true, values: {},                               order: 3,  required: true  },
        { id: 'pr5',  label: 'Asistente Sonido',         type: 'person', shared: true, values: {},                               order: 4,  required: false },
        { id: 'pr6',  label: 'Stage',                    type: 'person', shared: true, values: {},                               order: 5,  required: false },
        { id: 'pr7',  label: 'Iluminación',              type: 'person', shared: true, values: {},                               order: 6,  required: false },
        { id: 'pr8',  label: 'Visuales',                 type: 'person', shared: true, values: {},                               order: 7,  required: false },
        { id: 'pr9',  label: 'ProPresenter',             type: 'person', shared: true, values: {},                               order: 8,  required: false },
        { id: 'pr10', label: 'Broadcast',                type: 'person', shared: true, values: {},                               order: 9,  required: false },
        { id: 'pr11', label: 'RRSS',                     type: 'person', shared: true, values: {},                               order: 10, required: false },
        { id: 'pr12', label: 'Fotografía y Edición',     type: 'person', shared: true, values: {},                               order: 11, required: false },
        { id: 'pr13', label: 'Registro Audiovisual',     type: 'person', shared: true, values: {},                               order: 12, required: false },
        { id: 'pr14', label: 'Historias',                type: 'person', shared: true, values: {},                               order: 13, required: false },
      ];

    // ── Streaming ──────────────────────────────────────────────────────────
    case 'streaming':
      return [
        { id: 'st1', label: 'Director / Wirecast', type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'st2', label: 'Cam 1',              type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'st3', label: 'Cam 2',              type: 'person', shared: true, values: {}, order: 2, required: false },
        { id: 'st4', label: 'Cam 3 / Pluma',      type: 'person', shared: true, values: {}, order: 3, required: false },
        { id: 'st5', label: 'Cam 4 / Móvil',      type: 'person', shared: true, values: {}, order: 4, required: false },
      ];

    // ── Set List ───────────────────────────────────────────────────────────
    case 'setList':
      return [
        { id: 'sl1', label: 'Canción 1', type: 'song', shared: false, values: {}, order: 0, required: false },
        { id: 'sl2', label: 'Canción 2', type: 'song', shared: false, values: {}, order: 1, required: false },
        { id: 'sl3', label: 'Canción 3', type: 'song', shared: false, values: {}, order: 2, required: false },
        { id: 'sl4', label: 'Canción 4', type: 'song', shared: false, values: {}, order: 3, required: false },
        { id: 'sl5', label: 'Canción 5', type: 'song', shared: false, values: {}, order: 4, required: false },
        { id: 'sl6', label: 'Canción 6', type: 'song', shared: false, values: {}, order: 5, required: false },
      ];

    // ── Horarios ───────────────────────────────────────────────────────────
    case 'horarios':
      return [
        { id: 'h1', label: 'Preparación sala',    type: 'text', shared: true,  values: {}, order: 0, required: false },
        { id: 'h2', label: 'Apertura puertas',    type: 'text', shared: false, values: {}, order: 1, required: false },
        { id: 'h3', label: 'Ensayo',              type: 'text', shared: false, values: {}, order: 2, required: false },
        { id: 'h4', label: 'Inicio Encuentro',    type: 'text', shared: false, values: {}, order: 3, required: false },
        { id: 'h5', label: 'Inicio Worship',      type: 'text', shared: false, values: {}, order: 4, required: false },
        { id: 'h6', label: 'Predicación',         type: 'text', shared: false, values: {}, order: 5, required: false },
        { id: 'h7', label: 'Tiempo de Respuesta', type: 'text', shared: false, values: {}, order: 6, required: false },
        { id: 'h8', label: 'Cierre / Despedida',  type: 'text', shared: false, values: {}, order: 7, required: false },
      ];

    // ── Info Encuentro ─────────────────────────────────────────────────────
    case 'anuncios':
      return [
        { id: 'an1', label: 'Info Bienvenida',  type: 'text', shared: true, values: {}, order: 0, required: false },
        { id: 'an2', label: 'Info Despedida 1', type: 'text', shared: true, values: {}, order: 1, required: false },
        { id: 'an3', label: 'Info Despedida 2', type: 'text', shared: true, values: {}, order: 2, required: false },
        { id: 'an4', label: 'Info Despedida 3', type: 'text', shared: true, values: {}, order: 3, required: false },
        { id: 'an5', label: 'Próximo evento',   type: 'text', shared: true, values: {}, order: 4, required: false },
      ];

    // ── Voluntarios ────────────────────────────────────────────────────────
    case 'voluntarios':
      return [
        { id: 'v1',  label: 'Encargado',         type: 'person', shared: true, values: {}, order: 0,  required: false },
        { id: 'v2',  label: 'Carteles 1',        type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'v3',  label: 'Carteles 2',        type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'v4',  label: 'AR Kids',           type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'v5',  label: 'AR Tweens',         type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'v6',  label: 'Cafetería',         type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'v7',  label: 'Ingreso Auditorio', type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'v8',  label: 'Auditorio',         type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'v9',  label: 'Siembra',           type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'v10', label: 'Sala bebés',        type: 'person', shared: true, values: {}, order: 9,  required: false },
      ];
  }
  return [];
}

// ── Filas predeterminadas — Encuentro de Oración ─────────────────────────────

function defaultRowsOracion(section: SectionName): any[] {
  switch (section) {

    // ── Equipo Plataforma (Oradores) ───────────────────────────────────────
    case 'pastoral':
      return [
        { id: 'or_p1', label: 'Orador 1', type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'or_p2', label: 'Orador 2', type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_p3', label: 'Orador 3', type: 'person', shared: true, values: {}, order: 2, required: false },
      ];

    // ── Equipo ARW (simplificado) ──────────────────────────────────────────
    case 'escena':
      return [
        { id: 'or_e1', label: 'Vox / Gtr',   type: 'person', shared: true, values: {}, order: 0, required: false },
        { id: 'or_e2', label: 'Vox / Piano', type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_e3', label: 'Gtr / MD',    type: 'person', shared: true, values: {}, order: 2, required: false },
      ];

    // ── Equipo Técnico (oración) ───────────────────────────────────────────
    case 'produccion':
      return [
        { id: 'or_pr1',  label: 'Prod. Responsable',   type: 'person', shared: true, values: {}, order: 0,  required: true  },
        { id: 'or_pr2',  label: 'Productor',           type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'or_pr3',  label: 'Sala',                type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'or_pr4',  label: 'Asist. Sonido',       type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'or_pr5',  label: 'Broadcast',           type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'or_pr6',  label: 'Stage',               type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'or_pr7',  label: 'Visual / ProPresenter', type: 'person', shared: true, values: {}, order: 6, required: false },
        { id: 'or_pr8',  label: 'Visual / Arena',      type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'or_pr9',  label: 'Historias',           type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'or_pr10', label: 'Iluminación',         type: 'person', shared: true, values: {}, order: 9,  required: false },
        { id: 'or_pr11', label: 'Registro',            type: 'person', shared: true, values: {}, order: 10, required: false },
        { id: 'or_pr12', label: 'Fotografía',          type: 'person', shared: true, values: {}, order: 11, required: false },
      ];

    // ── Equipo Streaming (oración) ─────────────────────────────────────────
    case 'streaming':
      return [
        { id: 'or_st1', label: 'Responsable',    type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'or_st2', label: 'Dir. TV',        type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_st3', label: 'Cam 1',          type: 'person', shared: true, values: {}, order: 2, required: false },
        { id: 'or_st4', label: 'Cam 2',          type: 'person', shared: true, values: {}, order: 3, required: false },
        { id: 'or_st5', label: 'Cam 3',          type: 'person', shared: true, values: {}, order: 4, required: false },
        { id: 'or_st6', label: 'Cam 4 (Móvil)',  type: 'person', shared: true, values: {}, order: 5, required: false },
      ];

    // ── Set List — canciones de oración (shared, por momento) ─────────────
    case 'setList':
      return [
        { id: 'or_sl1', label: 'Bienvenida — Canción',           type: 'song', shared: true, values: {}, order: 0, required: false },
        { id: 'or_sl2', label: 'Gratitud — Canción',             type: 'song', shared: true, values: {}, order: 1, required: false },
        { id: 'or_sl3', label: 'Testimonios — Canción',          type: 'song', shared: true, values: {}, order: 2, required: false },
        { id: 'or_sl4', label: 'Peticiones — Canción 1',         type: 'song', shared: true, values: {}, order: 3, required: false },
        { id: 'or_sl5', label: 'Peticiones — Canción 2',         type: 'song', shared: true, values: {}, order: 4, required: false },
        { id: 'or_sl6', label: 'Oración Presencial — Canción 1', type: 'song', shared: true, values: {}, order: 5, required: false },
        { id: 'or_sl7', label: 'Oración Presencial — Canción 2', type: 'song', shared: true, values: {}, order: 6, required: false },
      ];

    // ── Horarios — flujo del Encuentro de Oración ──────────────────────────
    case 'horarios':
      return [
        { id: 'or_h1',  label: '05:00 — Llegada de Equipo',                      type: 'text', shared: true, values: { shared: 'Voluntarios · ARW · Equipo técnico' }, order: 0,  required: false },
        { id: 'or_h2',  label: '05:10-05:40 — Preparativos',                     type: 'text', shared: true, values: { shared: 'Ensambles · Prueba · Montaje áreas' },  order: 1,  required: false },
        { id: 'or_h3',  label: '05:25-05:35 — Link de Prueba',                   type: 'text', shared: true, values: { shared: 'Transmisión · Sonido' },               order: 2,  required: false },
        { id: 'or_h4',  label: '05:40-05:50 — VIO (Tiempo de ajustes)',           type: 'text', shared: true, values: { shared: 'Información Final Precisa' },          order: 3,  required: false },
        { id: 'or_h5',  label: '05:55 — Ingreso Auditorio',                      type: 'text', shared: true, values: {},                                               order: 4,  required: false },
        { id: 'or_h6',  label: '06:00 — Counter',                                type: 'text', shared: true, values: {},                                               order: 5,  required: false },
        { id: 'or_h7',  label: '06:05-06:08 — Bienvenida',                       type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'or_h8',  label: '06:12-06:17 — Gratitud',                         type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'or_h9',  label: '06:20-06:26 — Testimonios',                      type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'or_h10', label: '06:29-06:40 — Peticiones Campus Virtual',        type: 'person', shared: true, values: {}, order: 9,  required: false },
        { id: 'or_h11', label: '06:43-06:55 — Oración Peticiones',              type: 'person', shared: true, values: {}, order: 10, required: false },
        { id: 'or_h12', label: '07:00 — Despedida y Agradecimiento',             type: 'person', shared: true, values: {}, order: 11, required: false },
      ];

    default: return [];
  }
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildDefaultSections(type: string) {
  const activeSections = type === 'oracion' ? SECTIONS_ORACION : SECTIONS_REGULAR;
  const rowsFn = type === 'oracion' ? defaultRowsOracion : defaultRows;
  const sections: Record<string, any> = {};
  for (const name of activeSections) {
    sections[name] = {
      assignedTo:   null,
      assignedName: null,
      isCompleted:  false,
      completedBy:  null,
      completedAt:  null,
      rows:         rowsFn(name),
    };
  }
  return sections;
}

function buildDefaultCompletion(type: string): Partial<Record<SectionName, boolean>> {
  const activeSections = type === 'oracion' ? SECTIONS_ORACION : SECTIONS_REGULAR;
  return Object.fromEntries(activeSections.map((s) => [s, false]));
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FichasService {
  constructor(private fb: FirebaseService) {}

  async findAll(campusId?: string, status?: string) {
    let query: any = this.fb.db.collection(COL).orderBy('date', 'desc');
    if (campusId) query = query.where('campusId', '==', campusId);
    if (status)   query = query.where('status',   '==', status);
    const snap = await query.limit(50).get();
    return this.fb.toDocs(snap);
  }

  async findMine(userId: number, isAdmin: boolean) {
    const snap = await this.fb.db.collection(COL).orderBy('date', 'desc').limit(200).get();
    const all  = this.fb.toDocs(snap);
    if (isAdmin) return all;

    return all.filter((ficha: any) => {
      // el creador siempre ve sus propias fichas (publicadas o no)
      if (ficha.createdBy === userId) return true;
      // otros usuarios solo ven fichas publicadas donde están asignados
      if (!ficha.published) return false;
      const sections = ficha.sections ?? {};
      return Object.values(sections).some((sec: any) => sec?.assignedTo === userId);
    });
  }

  async findOne(fichaId: string) {
    const snap = await this.fb.db.collection(COL).doc(fichaId).get();
    if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
    return this.fb.toObj(snap);
  }

  async findPublic(fichaId: string) {
    const ficha = await this.findOne(fichaId);
    if (!ficha.published) throw new ForbiddenException('Esta ficha no está publicada');
    return ficha;
  }

  async create(dto: CreateFichaDto, userId: number, userName: string) {
    const ref     = this.fb.db.collection(COL).doc();
    const fichaId = ref.id;
    const encuentrosPlain = JSON.parse(JSON.stringify(dto.encuentros));
    const doc = {
      fichaId,
      campusId:         dto.campusId,
      campusName:       dto.campusName,
      type:             dto.type,
      title:            dto.title,
      date:             this.fb.ts(new Date(dto.date)),
      encuentros:       encuentrosPlain,
      ...(dto.descripcion ? { descripcion: dto.descripcion } : {}),
      ...(dto.ubicacion   ? { ubicacion:   dto.ubicacion }   : {}),
      sections:         buildDefaultSections(dto.type),
      completionStatus: buildDefaultCompletion(dto.type),
      status:           'draft',
      published:        false,
      createdBy:        userId,
      createdByName:    userName,
      createdAt:        this.fb.now(),
      lastModifiedBy:   userId,
      lastModifiedAt:   this.fb.now(),
    };
    await ref.set(doc);
    return this.findOne(fichaId);
  }

  async update(fichaId: string, dto: UpdateFichaDto, userId: number, userName?: string) {
    await this.findOne(fichaId);
    const data: any = { lastModifiedBy: userId, lastModifiedAt: this.fb.now() };
    if (userName !== undefined) data.lastModifiedByName = userName;
    if (dto.title          !== undefined) data.title          = dto.title;
    if (dto.status         !== undefined) data.status         = dto.status;
    if (dto.date           !== undefined) data.date           = this.fb.ts(new Date(dto.date));
    if (dto.hiddenSections !== undefined) data.hiddenSections = dto.hiddenSections;
    await this.fb.db.collection(COL).doc(fichaId).update(data);
    return this.findOne(fichaId);
  }

  async remove(fichaId: string) {
    await this.findOne(fichaId);
    await this.fb.db.collection(COL).doc(fichaId).delete();
    return { fichaId };
  }

  async clone(fichaId: string, userId: number, userName: string, dto: CloneFichaDto = {}) {
    const original = await this.findOne(fichaId);
    const ref   = this.fb.db.collection(COL).doc();
    const newId = ref.id;
    const sections = JSON.parse(JSON.stringify(original.sections));

    for (const name of SECTIONS) {
      if (sections[name]) {
        sections[name].isCompleted = false;
        sections[name].completedBy = null;
        sections[name].completedAt = null;
        sections[name].rows = (sections[name].rows ?? []).map((r: any) => ({ ...r, values: {} }));
        // Limpiar responsables solo si no se pidió conservarlos
        if (!dto.keepAssignees) {
          sections[name].assignedTo   = null;
          sections[name].assignedName = null;
        }
      }
    }

    // Generar título automático si se provee fecha
    let title = dto.title ?? `${original.title} (copia)`;
    if (!dto.title && dto.date) {
      const d = new Date(dto.date);
      const dateStr = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
      // Usar el título base quitando cualquier "(copia)" previo
      const baseTitle = original.title.replace(/\s*\(copia\).*$/, '').trim();
      title = `${baseTitle} — ${dateStr}`;
    }

    const doc = {
      ...original,
      fichaId:          newId,
      title,
      date:             dto.date ? this.fb.ts(new Date(dto.date)) : original.date,
      sections,
      completionStatus: buildDefaultCompletion(original.type ?? 'multi'),
      status:           'draft',
      published:        false,
      publishedBy:      null,
      publishedByName:  null,
      publishedAt:      null,
      createdBy:        userId,
      createdByName:    userName,
      createdAt:        this.fb.now(),
      lastModifiedBy:   userId,
      lastModifiedAt:   this.fb.now(),
    };
    await ref.set(doc);
    return this.findOne(newId);
  }

  async updateSection(
    fichaId: string,
    sectionName: string,
    dto: UpdateSectionDto,
    userId: number,
    userName: string,
  ) {
    const ficha = await this.findOne(fichaId);
    if (!SECTIONS.includes(sectionName as SectionName)) {
      throw new NotFoundException(`Sección ${sectionName} no existe`);
    }
    const dtoPlain = JSON.parse(JSON.stringify(dto));
    const update: any = {
      [`sections.${sectionName}`]: {
        ...ficha.sections[sectionName],
        ...dtoPlain,
      },
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(fichaId).update(update);

    await this.fb.db.collection(COL).doc(fichaId).collection('changelog').add({
      userId,
      userName,
      timestamp: this.fb.now(),
      seccion:   sectionName,
      cambios:   dtoPlain,
    });

    return this.findOne(fichaId);
  }

  async completeSection(
    fichaId: string,
    sectionName: string,
    userId: number,
    userName: string,
  ) {
    const ficha = await this.findOne(fichaId);
    if (!SECTIONS.includes(sectionName as SectionName)) {
      throw new NotFoundException(`Sección ${sectionName} no existe`);
    }
    const update: any = {
      [`sections.${sectionName}.isCompleted`]: true,
      [`sections.${sectionName}.completedBy`]: userId,
      [`sections.${sectionName}.completedAt`]: this.fb.now(),
      [`completionStatus.${sectionName}`]:     true,
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    };
    const visibleSections = SECTIONS.filter(s => !(ficha.hiddenSections ?? []).includes(s));
    const allDone = visibleSections.every(s =>
      s === sectionName ? true : ficha.completionStatus?.[s] === true,
    );
    if (allDone)                        update.status = 'complete';
    else if (ficha.status === 'draft')  update.status = 'in_progress';

    await this.fb.db.collection(COL).doc(fichaId).update(update);
    return this.findOne(fichaId);
  }

  async archive(fichaId: string, userId: number, userName: string) {
    await this.findOne(fichaId);
    await this.fb.db.collection(COL).doc(fichaId).update({
      archived:           true,
      archivedBy:         userId,
      archivedByName:     userName,
      archivedAt:         this.fb.now(),
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async unarchive(fichaId: string, userId: number, userName: string) {
    await this.findOne(fichaId);
    await this.fb.db.collection(COL).doc(fichaId).update({
      archived:           false,
      archivedBy:         null,
      archivedByName:     null,
      archivedAt:         null,
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async publish(fichaId: string, userId: number, userName: string) {
    await this.findOne(fichaId);
    await this.fb.db.collection(COL).doc(fichaId).update({
      published:        true,
      publishedBy:      userId,
      publishedByName:  userName,
      publishedAt:      this.fb.now(),
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async unpublish(fichaId: string, userId: number, userName: string) {
    await this.findOne(fichaId);
    await this.fb.db.collection(COL).doc(fichaId).update({
      published:        false,
      publishedBy:      null,
      publishedByName:  null,
      publishedAt:      null,
      lastModifiedBy:     userId,
      lastModifiedByName: userName,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async getChangelog(fichaId: string) {
    await this.findOne(fichaId);
    const snap = await this.fb.db
      .collection(COL).doc(fichaId)
      .collection('changelog').orderBy('timestamp', 'desc').limit(100).get();
    return this.fb.toDocs(snap);
  }
}
