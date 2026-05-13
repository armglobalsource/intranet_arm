export type OrgRole = 'area_leader' | 'team_leader' | 'member';

export interface OrgUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  jobTitles: { jobTitle: { name: string } }[];
  phone?: string | null;
  country?: string | null;
  bio?: string | null;
  campus?: { id: number; name: string } | null;
  status?: 'active' | 'inactive' | 'suspended';
}

/** Primer cargo del usuario o null */
export function orgUserJobTitle(u: OrgUser): string | null {
  return u.jobTitles?.[0]?.jobTitle.name ?? null;
}

export interface OrgMembership {
  id: number;
  role: OrgRole;
  customTitle?: string | null;
  sortOrder: number;
  userId: number;
  areaId?: number | null;
  teamId?: number | null;
  user: OrgUser;
}

export interface OrgTeam {
  id: number;
  areaId: number;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  desc?: string | null;
  colPosition: number;
  sortOrder: number;
  isActive: boolean;
  memberships: OrgMembership[];
}

export interface OrgArea {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string;
  iconUrl?: string | null;
  desc?: string | null;
  sortOrder: number;
  isActive?: boolean;
}

export interface OrgAreaTree extends OrgArea {
  leaders: OrgMembership[];
  teams: OrgTeam[];
}

/** Membresía enriquecida con área y equipo anidados (para paneles de detalle y búsqueda) */
export interface OrgMembershipFull {
  id: number;
  role: OrgRole;
  customTitle?: string | null;
  sortOrder: number;
  userId: number;
  areaId?: number | null;
  teamId?: number | null;
  area?: { id: number; name: string; color: string; slug: string; icon: string } | null;
  team?: {
    id: number;
    name: string;
    area?: { id: number; name: string; color: string; slug: string; icon: string } | null;
  } | null;
}

/** Devuelve el área efectiva de una membresía (directa o a través del equipo) */
export function membershipArea(m: OrgMembershipFull) {
  return m.area ?? m.team?.area ?? null;
}

/** Usuario con todas sus membresías en el organigrama */
export interface OrgUserProfile extends OrgUser {
  orgMemberships: OrgMembershipFull[];
}

export interface OrgSearchUser extends OrgUser {
  orgMemberships: OrgMembershipFull[];
}
