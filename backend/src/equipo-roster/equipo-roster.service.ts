import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { OrgChartService } from '../orgchart/orgchart.service';
import { DisponibilidadService } from '../disponibilidad/disponibilidad.service';
import { TecnicosService } from '../tecnicos/tecnicos.service';

export type RosterStatus   = 'disponible' | 'no_disponible' | 'sin_responder';
export type RosterCategory = 'worship' | 'tecnico' | 'ninguno';

export interface RosterPerson {
  userId:    number;
  userName:  string;
  avatarUrl: string | null;
  status:    RosterStatus;
}

export interface RosterResult {
  worship: RosterPerson[];
  tecnico: RosterPerson[];
  ninguno: RosterPerson[];
}

type Slots = Record<string, { available: boolean }>;

/**
 * Deriva el estado real de un usuario a partir de lo que efectivamente
 * respondió, sin importar en qué colección quedó (worship o técnicos) ni si
 * coincide con su categoría de organigrama — la categoría solo agrupa la
 * vista, no decide qué dato de disponibilidad se usa. Así, alguien que
 * respondió "no disponible" en la matriz de técnicos pero cuyo organigrama
 * no lo tiene en el área de Producción (o viceversa) igual refleja su
 * respuesta real en vez de aparecer siempre como "sin responder".
 */
function statusFromSlots(worshipSlots?: Slots, tecnicoSlots?: Slots): RosterStatus {
  const allValues = [
    ...Object.values(worshipSlots ?? {}),
    ...Object.values(tecnicoSlots ?? {}),
  ];
  if (allValues.length === 0) return 'sin_responder';
  return allValues.some((s) => s.available) ? 'disponible' : 'no_disponible';
}

@Injectable()
export class EquipoRosterService {
  constructor(
    private fb:            FirebaseService,
    private orgChart:      OrgChartService,
    private disponibilidad: DisponibilidadService,
    private tecnicos:      TecnicosService,
  ) {}

  async getRoster(campusId: number, weekLabel: string): Promise<RosterResult> {
    const [usersSnap, categoryMap, worshipMatrix, tecnicoMatrix] = await Promise.all([
      this.fb.db.collection('users')
        .select('id', 'firstName', 'lastName', 'avatarUrl', 'status')
        .get(),
      this.orgChart.getUserAreaCategoryMap(),
      this.disponibilidad.getMatrix(campusId, weekLabel),
      this.tecnicos.getMatrix(campusId, weekLabel),
    ]);

    const worshipByUser = new Map(worshipMatrix.volunteers.map((v) => [v.userId, v.slots]));
    const tecnicoByUser = new Map(tecnicoMatrix.tecnicos.map((t) => [t.userId, t.slots]));

    const result: RosterResult = { worship: [], tecnico: [], ninguno: [] };

    for (const u of this.fb.toDocs(usersSnap)) {
      if (u.status !== 'active') continue;

      const category = categoryMap[u.id] ?? 'ninguno';
      const status = statusFromSlots(worshipByUser.get(u.id), tecnicoByUser.get(u.id));

      result[category].push({
        userId:    u.id,
        userName:  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Sin nombre',
        avatarUrl: u.avatarUrl ?? null,
        status,
      });
    }

    (Object.keys(result) as RosterCategory[]).forEach((cat) => {
      result[cat].sort((a, b) => a.userName.localeCompare(b.userName));
    });

    return result;
  }
}
