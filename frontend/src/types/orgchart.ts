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
  desc?: string | null;
  sortOrder: number;
  isActive?: boolean;
}

export interface OrgAreaTree extends OrgArea {
  leaders: OrgMembership[];
  teams: OrgTeam[];
}

export interface OrgSearchUser extends OrgUser {
  orgMemberships: Array<{
    id: number;
    role: OrgRole;
    area?: OrgArea | null;
    team?: { id: number; name: string } | null;
  }>;
}
