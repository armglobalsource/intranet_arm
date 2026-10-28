import { describe, expect, it, vi } from 'vitest';
import { PostgresEncuentrosService } from './postgres-encuentros.service';
import { inMonth, inPeriodo } from '../common/arm-records.util';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEncuentroDto } from './dto/encuentro.dto';

const author = { sub: 7, email: 'author@example.test', campusId: 1, permissions: ['encuentros:create'] };
const reviewer = { sub: 8, email: 'reviewer@example.test', campusId: 1, permissions: ['encuentros:review'] };
const campus = { id: 1, name: 'Santiago', isActive: true, adminIds: [8] };
function fixture(extra = {}) {
  const record: any = { id: 'r1', fichaId: 'r1', campusId: 1, campus: 'Santiago', fecha: '2021-09-05', tipo: 'encuentro', encuentro: 'Domingo 11:00', estado: 'enviado', registradoPor: { uid: 7 }, totalAsistencia: 30, ...extra };
  const store = { find: vi.fn(async () => ({ ...record })), list: vi.fn(async () => [{ ...record }]),
    update: vi.fn(async (_table, _id, data) => Object.assign(record, data)), remove: vi.fn(),
    create: vi.fn(async (_table, data) => { Object.assign(record, data); return {id: 'r1'}; }) };
  const notifications = { create: vi.fn(async () => ({})), createForCampusPermission: vi.fn(async () => ({})) };
  const api = new PostgresEncuentrosService(store as any, { findOne: async () => campus, findAll: async () => [campus] } as any, notifications as any);
  return { api, store, record, notifications };
}

describe('revisión y sumas de encuentros', () => {
  it('valida oradores y calcula 60 presenciales sin mezclar los 362 online', async () => {
    const {api, record} = fixture();
    const dto = plainToInstance(CreateEncuentroDto, {tipo: 'encuentro', campus: 'Santiago', fecha: '2026-10-21',
      encuentro: 'Encuentro Oración Miércoles 06:00 hrs', modalidad: 'Presencial+Online',
      asistencia: {auditorio: 21}, voluntarios: {oradores: 5, servicio: 7, tecnica: 18, worship: 4, cocina: 1, rrss: 2, seguridad: 2},
      presencial: {total: 999}, online: {espectadores: 362}, lideres: 'Iván Cifuentes y Nattaly Medina', adm: 'Administradores de Santiago'});
    expect(await validate(dto, {whitelist: true, forbidNonWhitelisted: true})).toEqual([]);
    await api.create(dto, author);
    expect(record).toMatchObject({totalAsistencia: 21, totalVoluntarios: 39, presencial: {total: 60}, online: {espectadores: 362}, voluntarios: {oradores: 5}, lideres: dto.lideres, adm: dto.adm});
    await api.update('r1', {voluntarios: {...dto.voluntarios, servicio: 8}}, author);
    expect(record.presencial.total).toBe(61);
    expect(record.totalAsistencia).toBe(21);
    expect(record.online.espectadores).toBe(362);
  });
  it('no suma pendientes: devolver, corregir y subir conserva las cifras y la trazabilidad', async () => {
    const { api, record, notifications } = fixture();
    expect((await api.resumen('Santiago', 2021, 9)).encuentros.count).toBe(0);
    expect((await api.observar('r1', 'Revisar Kids', reviewer)).estado).toBe('observado');
    expect(notifications.create).toHaveBeenCalledOnce();
    expect((await api.update('r1', { asistencia: { auditorio: 40, kids: 5 } }, author)).estado).toBe('enviado');
    expect(record.totalAsistencia).toBe(45);
    expect(notifications.createForCampusPermission).toHaveBeenCalledOnce();
    await api.subir('r1', reviewer);
    expect((await api.resumen('Santiago', 2021, 9)).encuentros).toMatchObject({ count: 1, totalAsistencia: 45 });
    expect(record.revisadoPor.uid).toBe(8);
    await expect(api.update('r1', { mensaje: 'Cambio' }, author)).rejects.toThrow(/ya fue subido/);
    await api.observar('r1', 'Corregir', reviewer);
    expect((await api.resumen('Santiago', 2021, 9)).encuentros.count).toBe(0);
  });

  it('rechaza revisión y edición desde otro campus sin escribir ni notificar', async () => {
    const { api, store, notifications } = fixture();
    const outsider = { ...reviewer, sub: 99, campusId: 2, permissions: ['encuentros:review', 'encuentros:edit'] };
    await expect(api.subir('r1', outsider)).rejects.toThrow();
    await expect(api.observar('r1', 'Cambio', outsider)).rejects.toThrow();
    await expect(api.update('r1', { mensaje: 'Cambio' }, outsider)).rejects.toThrow();
    expect(store.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('mantiene visibles los pendientes antiguos y no incluye el histórico ya subido', async () => {
    const { api, record, store } = fixture();
    expect((await api.revision(reviewer)).items).toHaveLength(1);
    expect(store.list).toHaveBeenCalledWith('encuentros', { campus: 'Santiago' });
    record.id = record.fichaId = 'asana:1185873534171121:123';
    expect((await api.revision(reviewer)).items).toHaveLength(0);
    await api.observar(record.id, 'Cifra por confirmar', reviewer);
    expect((await api.revision(reviewer)).items).toHaveLength(1);
  });

  it('protege fechas mensuales y rechaza días inexistentes', async () => {
    const { api, store } = fixture({ fecha: '2021-09-01', fechaPrecision: 'mes', periodo: '2021-09' });
    await expect(api.update('r1', { fecha: '2021-09-05' }, reviewer)).rejects.toThrow(/solo tiene mes/);
    await expect(api.update('r1', { fecha: '2021-02-30' }, reviewer)).rejects.toThrow(/fecha válida/);
    expect(store.update).not.toHaveBeenCalled();
    expect(inMonth('2021-09-01', 2021, 9)).toBe(true);
    expect(inMonth('2021-09-01', 2021, 8)).toBe(false);
    expect(inPeriodo('2021-09-01', 'semana', 'mes')).toBe(false);
  });
});
