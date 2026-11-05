import { describe, it, expect, vi } from 'vitest';
import { weeklyControl } from './encuentros.control';
import { PostgresEncuentrosService } from './postgres-encuentros.service';

const campus = { id: 1, name: 'Santiago', isActive: true, schedules: [{dia:'Domingo',hora:'09:00'},{dia:'Domingo',hora:'11:00'}] };
const now = {date:'2026-11-04',time:'12:00'};
describe('control semanal desde el histórico', () => {
  it('mantiene faltantes antiguos al registrar semanas posteriores, sin tope de 120 días', () => {
    const anchors = new Map([['1','2026-05-03']]);
    const before = weeklyControl([campus],[],anchors,'2026-10-24',now);
    const after = weeklyControl([campus],[{id:'new',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 09:00',estado:'enviado'}],anchors,'2026-10-24',now);
    expect(after.pendientes.filter(p=>p.fecha==='2026-05-03')).toHaveLength(2);
    expect(after.pendientes.length).toBe(before.pendientes.length-1);
    expect(after.progreso[0].desde).toBe('2026-04-27');
    expect(after.reportes[0].estado).toBe('enviado');
  });
  it('los duplicados, eventos, registros mensuales y reportes sin hora no cubren otros encuentros', () => {
    const records = [
      {id:'a',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 09:00'},
      {id:'b',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 09:00'},
      {id:'c',campusId:1,fecha:'2026-11-01',encuentro:'Domingo'},
      {id:'d',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 11:00',tipo:'evento'},
      {id:'e',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 11:00',fechaPrecision:'mes'},
    ];
    const result=weeklyControl([campus],records,new Map([['1','2026-11-01']]),now.date,now);
    expect(result.pendientes.map(p=>p.hora)).toEqual(['11:00']);
  });
  it('espera dos horas incluso si un encuentro cruza la medianoche y descarta horarios inválidos', () => {
    const late = {...campus,schedules:[{dia:'Martes',hora:'23:00'},{dia:'Martes',hora:'29:99'}]};
    const anchors = new Map([['1','2026-11-03']]);
    expect(weeklyControl([late],[],anchors,now.date,{date:'2026-11-04',time:'00:30'}).pendientes).toHaveLength(0);
    expect(weeklyControl([late],[],anchors,now.date,{date:'2026-11-04',time:'01:00'}).pendientes).toHaveLength(1);
  });
  it('distingue campus sin horarios, Virtual e inactivos; respeta los estados de revisión', () => {
    const result = weeklyControl([campus,{id:2,name:'Miami'},{id:3,name:'Virtual'},{id:4,name:'Oriente',isActive:false}],
      [{id:'asana:one',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 09:00',estado:'enviado'},
       {id:'two',campusId:1,fecha:'2026-11-01',encuentro:'Domingo 11:00',estado:'observado'}],new Map(), '2026-10-24',now);
    expect(result.progreso.map(c=>c.seguimiento)).toEqual(['sin_horarios','horarios','virtual']);
    expect(result.reportes.map(r=>r.estado)).toEqual(['subido','observado']);
    expect(result.pendientes.some(p=>p.campusId!==1)).toBe(false);
  });
  it('solo lee y entrega los campus autorizados; incluye administradores listados de otro campus', async () => {
    const store = {encounterControlAnchors:vi.fn(async()=>new Map([['__baseline','2026-10-24']])),encounterControlRows:vi.fn(async()=>[])};
    const campuses = {findAll:async()=>[campus,{...campus,id:2,name:'Puente Alto',adminIds:[8]}]};
    const service = new PostgresEncuentrosService(store as any,campuses as any);
    await service.pendientes({sub:7,email:'demo@example.test',campusId:1,permissions:['encuentros:create']});
    expect(store.encounterControlRows.mock.calls[0][0]).toEqual([1]);
    await service.pendientes({sub:8,email:'demo@example.test',campusId:1,permissions:[]});
    expect(store.encounterControlRows.mock.calls[1][0]).toEqual([2]);
    await expect(service.pendientes({sub:9,email:'demo@example.test',permissions:[]})).rejects.toMatchObject({status:403});
  });
});
