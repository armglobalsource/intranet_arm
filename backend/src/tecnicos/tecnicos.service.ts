import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CampusService } from '../campus/campus.service';
import { BulkSubmitDto } from './dto/tecnicos.dto';

const COL = 'disponibilidades-tecnicos';

const DIA_TO_DOW: Record<string, number> = {
  Lunes: 0, Martes: 1, 'Miércoles': 2, Miercoles: 2,
  Jueves: 3, Viernes: 4, 'Sábado': 5, Sabado: 5, Domingo: 6,
};

export interface EncounterSlot {
  scheduleKey:   string;
  dia:           string;
  hora:          string;
  bloque?:       string;
  encounterDate: Date;
  fichaType?:    string;
}

export interface MatrixTecnico {
  userId:   number;
  userName: string;
  slots:    Record<string, { available: boolean; nota: string | null }>;
}

export interface EncounterSlotSerialized {
  scheduleKey:   string;
  dia:           string;
  hora:          string;
  bloque?:       string;
  encounterDate: string;
  fichaType?:    string;
}

export interface MatrixResult {
  encounters: EncounterSlotSerialized[];
  tecnicos:   MatrixTecnico[];
}

function weekLabelToMonday(weekLabel: string): Date {
  const match = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`weekLabel inválido: ${weekLabel}`);
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow  = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

@Injectable()
export class TecnicosService {
  constructor(
    private fb:            FirebaseService,
    private campusService: CampusService,
  ) {}

  /** Slots de encuentro (misma lógica que worship — mismos campus schedules) */
  async getEncounters(campusId: number, weekLabel: string): Promise<EncounterSlot[]> {
    const campus = await this.campusService.findOne(campusId);
    if (!campus.schedules?.length) return [];

    const weekStart = weekLabelToMonday(weekLabel);

    const groups = new Map<string, { schedules: any[]; dia: string; bloque?: string }>();
    for (const s of campus.schedules as any[]) {
      const key = s.bloque ? `${s.dia}_${s.bloque}` : `${s.dia}_${s.hora}`;
      if (!groups.has(key)) {
        groups.set(key, { schedules: [], dia: s.dia as string, bloque: s.bloque ?? undefined });
      }
      groups.get(key)!.schedules.push(s);
    }

    const slots: EncounterSlot[] = [];
    for (const [key, { schedules, dia, bloque }] of groups) {
      const diaCapitalized = dia.charAt(0).toUpperCase() + dia.slice(1);
      const dow = DIA_TO_DOW[diaCapitalized] ?? DIA_TO_DOW[dia];
      if (dow === undefined) {
        console.warn(`[TecnicosService] Día desconocido: "${dia}" (scheduleKey: ${key}) — schedule ignorado`);
        continue;
      }

      schedules.sort((a, b) => (a.hora as string).localeCompare(b.hora as string));

      const [h, m] = (schedules[0].hora as string).split(':').map(Number);
      const encounterDate = new Date(weekStart.getTime() + dow * 86400000);
      encounterDate.setUTCHours(h, m, 0, 0);

      slots.push({
        scheduleKey:   key,
        dia,
        hora:          schedules.map((s) => s.hora as string).join(' · '),
        bloque,
        encounterDate,
        fichaType:     schedules[0].fichaType ?? undefined,
      });
    }

    return slots.sort((a, b) => a.encounterDate.getTime() - b.encounterDate.getTime());
  }

  /** Upsert de disponibilidad para todos los slots de la semana (técnico) */
  async bulkSubmit(userId: number, userName: string, dto: BulkSubmitDto) {
    const campus    = await this.campusService.findOne(dto.campusId);
    const encounters = await this.getEncounters(dto.campusId, dto.weekLabel);
    const encMap    = new Map(encounters.map((e) => [e.scheduleKey, e]));

    const results: any[] = [];

    for (const slot of dto.slots) {
      const enc = encMap.get(slot.scheduleKey);

      const existing = await this.fb.db.collection(COL)
        .where('userId',      '==', userId)
        .where('weekLabel',   '==', dto.weekLabel)
        .where('scheduleKey', '==', slot.scheduleKey)
        .limit(1).get();

      const data: any = {
        userId,
        userName,
        campusId:    dto.campusId,
        campusName:  campus.name,
        weekLabel:   dto.weekLabel,
        scheduleKey: slot.scheduleKey,
        dia:         enc?.dia  ?? '',
        hora:        enc?.hora ?? '',
        bloque:      enc?.bloque ?? null,
        available:   slot.available,
        nota:        slot.nota ?? null,
        updatedAt:   this.fb.now(),
      };
      if (enc?.encounterDate) data.encounterDate = this.fb.ts(enc.encounterDate);

      if (!existing.empty) {
        await existing.docs[0].ref.update(data);
        results.push({ ...data, id: existing.docs[0].data().id });
      } else {
        const id = await this.fb.nextId(COL);
        data.id        = id;
        data.createdAt = this.fb.now();
        await this.fb.db.collection(COL).doc(String(id)).set(data);
        results.push(data);
      }
    }

    return results;
  }

  /** Todos los compromisos (available=true) del técnico para el calendario */
  async getMyCommitments(userId: number, campusId: number) {
    const snap = await this.fb.db.collection(COL)
      .where('userId',    '==', userId)
      .where('campusId',  '==', campusId)
      .where('available', '==', true)
      .get();
    const docs = this.fb.toDocs(snap) as any[];
    return docs.sort((a, b) => {
      const da = a.encounterDate?.seconds ?? 0;
      const db = b.encounterDate?.seconds ?? 0;
      return da - db;
    });
  }

  /** Respuestas del técnico para una semana */
  async getMyWeek(userId: number, campusId: number, weekLabel: string) {
    const snap = await this.fb.db.collection(COL)
      .where('userId',    '==', userId)
      .where('campusId',  '==', campusId)
      .where('weekLabel', '==', weekLabel)
      .get();
    return this.fb.toDocs(snap);
  }

  /** Matriz técnico × encuentro (coordinador / admin) */
  async getMatrix(campusId: number, weekLabel: string): Promise<MatrixResult> {
    const encounters = await this.getEncounters(campusId, weekLabel);

    const snap = await this.fb.db.collection(COL)
      .where('campusId',  '==', campusId)
      .where('weekLabel', '==', weekLabel)
      .get();

    const docs = this.fb.toDocs(snap);

    const byUser = new Map<number, MatrixTecnico>();
    for (const doc of docs) {
      if (!byUser.has(doc.userId)) {
        byUser.set(doc.userId, {
          userId:   doc.userId,
          userName: doc.userName,
          slots:    {},
        });
      }
      byUser.get(doc.userId)!.slots[doc.scheduleKey] = {
        available: doc.available,
        nota:      doc.nota ?? null,
      };
    }

    const tecnicos = Array.from(byUser.values())
      .sort((a, b) => a.userName.localeCompare(b.userName));

    return {
      encounters: encounters.map((e) => ({
        ...e,
        encounterDate: e.encounterDate.toISOString(),
      })),
      tecnicos,
    };
  }

  /** Semanas con submissions para un campus */
  async getWeeks(campusId: number): Promise<string[]> {
    const snap = await this.fb.db.collection(COL)
      .where('campusId', '==', campusId)
      .get();
    const labels = new Set<string>(
      this.fb.toDocs(snap).map((d) => d.weekLabel as string),
    );
    return Array.from(labels).sort().reverse();
  }
}
