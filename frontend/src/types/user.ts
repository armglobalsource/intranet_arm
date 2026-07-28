export interface UserDepartment {
  id: number;
  name: string;
}

export interface UserRole {
  id: number;
  name: string;
}

export interface UserCampus {
  id: number;
  name: string;
  address?: string | null;
}

export interface UserJobTitle {
  id: number;
  name: string;
}

export type UserGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

// ── Nombramiento ministerial ──────────────────────────────────────────────────

export type MinisterialTitle = 'pastor_principal' | 'pastor' | 'ministro';

export const MINISTERIAL_LABEL: Record<MinisterialTitle, string> = {
  pastor_principal: 'Pastor Principal',
  pastor:           'Pastor',
  ministro:         'Ministro',
};

export const MINISTERIAL_PREFIX: Record<MinisterialTitle, string> = {
  pastor_principal: 'Ps. Ppal.',
  pastor:           'Ps.',
  ministro:         'Min.',
};

/** Devuelve el prefijo abreviado del nombramiento, o cadena vacía */
export function ministerialPrefix(u: { ministerialTitle?: string | null }): string {
  const t = u.ministerialTitle as MinisterialTitle | null | undefined;
  return t ? (MINISTERIAL_PREFIX[t] ?? '') : '';
}

/** Nombre completo con prefijo ministerial antepuesto si aplica */
export function displayName(u: { firstName: string; lastName?: string | null; ministerialTitle?: string | null }): string {
  const prefix = ministerialPrefix(u);
  const name   = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return prefix ? `${prefix} ${name}` : name;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  country?: string | null;
  bio?: string | null;
  birthDate?: string | null;
  gender?: UserGender | null;
  ministerialTitle?: MinisterialTitle | null;
  /** Mes/año en que se unió a la organización, formato "YYYY-MM" */
  memberSince?: string | null;
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'rejected';
  departmentId?: number | null;
  campusId?: number | null;
  department?: UserDepartment | null;
  campus?: UserCampus | null;
  role?: UserRole | null;
  jobTitles: { jobTitle: UserJobTitle; source?: 'manual' | 'orgchart' }[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserDto {
  firstName?:   string;
  lastName?:    string;
  email?:       string;
  password?:    string;
  roleId?:      number;
  campusId?:    number | null;
  jobTitleIds?: number[];
  phone?:       string;
  country?:     string;
  bio?:         string;
  birthDate?:   string | null;
  gender?:            UserGender | null;
  ministerialTitle?:  MinisterialTitle | null;
  memberSince?:       string | null;
  status?:            'active' | 'inactive' | 'suspended' | 'rejected';
}

/** Extrae los nombres de cargos de un usuario */
export function userJobTitleNames(u: Pick<User, 'jobTitles'>): string[] {
  return u.jobTitles.map((jt) => jt.jobTitle.name);
}

/** Primer cargo como string, o null */
export function primaryJobTitle(u: Pick<User, 'jobTitles'>): string | null {
  return u.jobTitles[0]?.jobTitle.name ?? null;
}
