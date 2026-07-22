import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import {
  CreateAdministradorDto, UpdateAdministradorDto,
  CreateEquipoDto, UpdateEquipoDto,
  GenerarCalendarioDto, UpdateTurnoDto,
} from './dto/campus-turno.dto';

const COL_ADMIN  = 'campus_administradores';
const COL_EQUIPO = 'campus_equipos';
const COL_TURNO  = 'campus_turnos';

@Injectable()
export class CampusTurnosService {
  constructor(private fb: FirebaseService) {}

  // ── Administradores (roster por campus) ─────────────────────────────────────

  async findAdministradores(campusId: number) {
    const snap = await this.fb.db.collection(COL_ADMIN).where('campusId', '==', campusId).get();
    return this.fb.toDocs(snap)
      .filter((a) => a.isActive !== false)
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  }

  async createAdministrador(dto: CreateAdministradorDto) {
    const id = await this.fb.nextId(COL_ADMIN);
    const doc = {
      id, campusId: dto.campusId, nombre: dto.nombre.trim(), isActive: true,
      createdAt: this.fb.now(), updatedAt: this.fb.now(),
    };
    await this.fb.db.collection(COL_ADMIN).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL_ADMIN).doc(String(id)).get());
  }

  async updateAdministrador(id: number, dto: UpdateAdministradorDto) {
    const ref = this.fb.db.collection(COL_ADMIN).doc(String(id));
    if (!(await ref.get()).exists) throw new NotFoundException(`Administrador ${id} no encontrado`);
    const data: any = { updatedAt: this.fb.now() };
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    await ref.update(data);
    return this.fb.toObj(await ref.get());
  }

  // ── Equipos (agrupaciones que rotan) ────────────────────────────────────────

  async findEquipos(campusId: number) {
    const snap = await this.fb.db.collection(COL_EQUIPO).where('campusId', '==', campusId).get();
    return this.fb.toDocs(snap).filter((e) => e.isActive !== false);
  }

  async createEquipo(dto: CreateEquipoDto) {
    const id = await this.fb.nextId(COL_EQUIPO);
    const doc = {
      id, campusId: dto.campusId, nombre: dto.nombre.trim(),
      administradorIds: dto.administradorIds, isActive: true,
      createdAt: this.fb.now(), updatedAt: this.fb.now(),
    };
    await this.fb.db.collection(COL_EQUIPO).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL_EQUIPO).doc(String(id)).get());
  }

  async updateEquipo(id: number, dto: UpdateEquipoDto) {
    const ref = this.fb.db.collection(COL_EQUIPO).doc(String(id));
    if (!(await ref.get()).exists) throw new NotFoundException(`Equipo ${id} no encontrado`);
    const data: any = { updatedAt: this.fb.now() };
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.administradorIds !== undefined) data.administradorIds = dto.administradorIds;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    await ref.update(data);
    return this.fb.toObj(await ref.get());
  }

  // ── Turnos (calendario semanal) ──────────────────────────────────────────────

  async findTurnos(campusId: number, desde?: string, hasta?: string) {
    const snap = await this.fb.db.collection(COL_TURNO).where('campusId', '==', campusId).get();
    let rows = this.fb.toDocs(snap);
    if (desde) rows = rows.filter((r) => r.fecha >= desde);
    if (hasta) rows = rows.filter((r) => r.fecha <= hasta);
    return rows.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }

  /**
   * Genera filas semanales rotando `equipoIds` en orden a partir de `fechaInicio`.
   * No pisa fechas que ya tengan un turno (permite re-ejecutar sin duplicar ni
   * perder ediciones manuales de semanas puntuales).
   */
  async generar(dto: GenerarCalendarioDto) {
    const equipoSnaps = await Promise.all(
      dto.equipoIds.map((eid) => this.fb.db.collection(COL_EQUIPO).doc(String(eid)).get()),
    );
    const equipoNombres = new Map<number, string>();
    equipoSnaps.forEach((snap, i) => {
      if (!snap.exists) throw new NotFoundException(`Equipo ${dto.equipoIds[i]} no encontrado`);
      equipoNombres.set(dto.equipoIds[i], snap.data()!.nombre);
    });

    const existing = await this.fb.db.collection(COL_TURNO).where('campusId', '==', dto.campusId).get();
    const existingFechas = new Set(this.fb.toDocs(existing).map((r) => r.fecha));

    const start = new Date(`${dto.fechaInicio}T12:00:00Z`);
    let creados = 0;
    for (let i = 0; i < dto.semanas; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i * 7);
      const fecha = d.toISOString().slice(0, 10);
      if (existingFechas.has(fecha)) continue;

      const equipoId = dto.equipoIds[i % dto.equipoIds.length];
      const id = await this.fb.nextId(COL_TURNO);
      await this.fb.db.collection(COL_TURNO).doc(String(id)).set({
        id, campusId: dto.campusId, fecha, equipoId,
        equipoNombreSnapshot: equipoNombres.get(equipoId) ?? '',
        isManualOverride: false,
        createdAt: this.fb.now(), updatedAt: this.fb.now(),
      });
      creados++;
    }
    return { creados };
  }

  async updateTurno(id: number, dto: UpdateTurnoDto) {
    const ref = this.fb.db.collection(COL_TURNO).doc(String(id));
    if (!(await ref.get()).exists) throw new NotFoundException(`Turno ${id} no encontrado`);
    const equipoSnap = await this.fb.db.collection(COL_EQUIPO).doc(String(dto.equipoId)).get();
    if (!equipoSnap.exists) throw new NotFoundException(`Equipo ${dto.equipoId} no encontrado`);

    await ref.update({
      equipoId: dto.equipoId,
      equipoNombreSnapshot: equipoSnap.data()!.nombre,
      isManualOverride: true,
      updatedAt: this.fb.now(),
    });
    return this.fb.toObj(await ref.get());
  }
}
