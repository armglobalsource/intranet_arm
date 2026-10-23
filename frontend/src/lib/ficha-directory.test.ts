import { describe, expect, it } from 'vitest';
import { buildFichaDirectory, countryLabel, groupFichaDirectory, normalizeSearch } from './ficha-directory';
import type { FichaListItem } from '@/types/ficha';

const ficha = (id: string, campusId: string, campusName: string, date = '2026-10-23'): FichaListItem => ({ fichaId: id, campusId, campusName, date, title: 'Encuentro de oración', type: 'unico', status: 'draft', completionStatus: {} as FichaListItem['completionStatus'] });

describe('Directorio de fichas por país', () => {
  it('prioriza el ID y no mezcla campus con el mismo nombre en distintos países', () => {
    const entries = buildFichaDirectory([ficha('1', '1', 'Campus Centro'), ficha('2', '2', 'Centro')], [{ id: 1, name: 'Centro', country: 'Chile' }, { id: 2, name: 'Centro', country: 'Uruguay' }]);
    expect(groupFichaDirectory(entries).map((c) => [c.name, c.campuses[0].fichas[0].fichaId])).toEqual([['Chile', '1'], ['Uruguay', '2']]);
  });
  it('resuelve nombres históricos solo si son inequívocos y conserva desconocidos', () => {
    const entries = buildFichaDirectory([ficha('1', 'legacy', 'ARM Concepcion'), ficha('2', 'missing', 'Centro')], [{ id: 1, name: 'Concepción', country: 'CL' }, { id: 2, name: 'Centro', country: 'Chile' }, { id: 3, name: 'Centro', country: 'Uruguay' }]);
    expect(entries[0].campusName).toBe('Concepción');
    expect(entries[0].country).toBe('Chile');
    expect(entries[1].country).toBe('Sin país asignado');
  });
  it('normaliza códigos, variantes y espacios de países sin adivinar por ciudad', () => {
    expect(countryLabel(' cl ')).toBe('Chile');
    expect(countryLabel('USA')).toBe('Estados Unidos');
    expect(countryLabel('Estados  Unidos')).toBe('Estados Unidos');
    expect(countryLabel(null)).toBe('Sin país asignado');
    expect(countryLabel('  Perú ')).toBe('Perú');
  });
  it('ordena las fichas de cada campus por fecha y ubica los países faltantes al final', () => {
    const entries = buildFichaDirectory([ficha('old', '1', 'Santiago', '2026-09-01'), ficha('new', '1', 'Santiago'), ficha('unknown', '2', 'Nuevo')], [{ id: 1, name: 'Santiago', country: 'Chile' }]);
    const grouped = groupFichaDirectory(entries);
    expect(grouped[0].campuses[0].fichas.map((f) => f.fichaId)).toEqual(['new', 'old']);
    expect(grouped[1].name).toBe('Sin país asignado');
  });
  it('busca sin tildes por título, campus canónico o país', () => {
    const entry = buildFichaDirectory([ficha('1', '1', 'Campus Concepción')], [{ id: 1, name: 'Concepción', country: 'Chile' }])[0];
    for (const term of [' ORACION ', 'concepcion', 'CHILE']) expect(entry.searchText).toContain(normalizeSearch(term));
  });
});
