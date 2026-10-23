import type { CampusOption } from '@/hooks/useCampus';
import type { FichaListItem } from '@/types/ficha';
import { parseFichaDate } from './ficha-date';

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const campusNameKey = (value: string) => normalizeSearch(value).replace(/^(campus|arm)\s+/, '');
const COUNTRY_ALIASES: Record<string, string> = {
  cl: 'Chile', chile: 'Chile', ar: 'Argentina', argentina: 'Argentina',
  uy: 'Uruguay', uruguay: 'Uruguay', ve: 'Venezuela', venezuela: 'Venezuela',
  us: 'Estados Unidos', usa: 'Estados Unidos', 'ee.uu.': 'Estados Unidos', 'eeuu': 'Estados Unidos',
  'estados unidos': 'Estados Unidos', 'united states': 'Estados Unidos',
};

export function countryLabel(value?: string | null): string {
  const clean = value?.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Sin país asignado';
  const normalized = normalizeSearch(clean);
  return COUNTRY_ALIASES[normalized] ?? clean;
}

export interface DirectoryFicha {
  ficha: FichaListItem;
  campusKey: string;
  campusName: string;
  initials?: string | null;
  countryKey: string;
  country: string;
  searchText: string;
}

/** Resolve by ID first; legacy names match only when unambiguous. */
export function buildFichaDirectory(fichas: FichaListItem[], campuses: CampusOption[]): DirectoryFicha[] {
  const byId = new Map(campuses.map((c) => [String(c.id), c]));
  const byName = new Map<string, CampusOption[]>();
  for (const campus of campuses) {
    const key = campusNameKey(campus.name);
    byName.set(key, [...(byName.get(key) ?? []), campus]);
  }
  return fichas.map((ficha) => {
    const matches = byName.get(campusNameKey(ficha.campusName ?? '')) ?? [];
    const campus = byId.get(String(ficha.campusId)) ?? (matches.length === 1 ? matches[0] : undefined);
    const campusName = campus?.name ?? ficha.campusName ?? 'Campus sin identificar';
    const country = countryLabel(campus?.country);
    return {
      ficha, campusName, country, initials: campus?.siglas,
      campusKey: campus ? `campus:${campus.id}` : `unmatched:${ficha.campusId || campusNameKey(campusName)}`,
      countryKey: normalizeSearch(country),
      searchText: normalizeSearch(`${ficha.title} ${ficha.campusName} ${campusName} ${country}`),
    };
  });
}

export function groupFichaDirectory(entries: DirectoryFicha[]) {
  const countries = new Map<string, { key: string; name: string; campuses: Map<string, { key: string; name: string; initials?: string | null; fichas: FichaListItem[] }> }>();
  for (const entry of entries) {
    if (!countries.has(entry.countryKey)) countries.set(entry.countryKey, { key: entry.countryKey, name: entry.country, campuses: new Map() });
    const group = countries.get(entry.countryKey)!;
    if (!group.campuses.has(entry.campusKey)) group.campuses.set(entry.campusKey, { key: entry.campusKey, name: entry.campusName, initials: entry.initials, fichas: [] });
    group.campuses.get(entry.campusKey)!.fichas.push(entry.ficha);
  }
  return Array.from(countries.values()).sort((a, b) => {
    if (a.name === 'Sin país asignado') return 1;
    if (b.name === 'Sin país asignado') return -1;
    return a.name.localeCompare(b.name, 'es');
  }).map((country) => ({
    ...country,
    campuses: Array.from(country.campuses.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((campus) => ({
      ...campus,
      fichas: [...campus.fichas].sort((a, b) => {
        const time = (value: FichaListItem['date']) => { const n = parseFichaDate(value).getTime(); return Number.isFinite(n) ? n : 0; };
        return time(b.date) - time(a.date) || a.fichaId.localeCompare(b.fichaId);
      }),
    })),
  }));
}
