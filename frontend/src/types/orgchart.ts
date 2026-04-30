export type OrgNodeType = 'leader' | 'group' | 'person';

export interface OrgArea {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string;
  desc?: string | null;
  sortOrder: number;
}

export interface OrgLinkedUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  country?: string | null;
}

export interface OrgNode {
  id: number;
  areaId: number;
  parentId: number | null;
  userId?: number | null;
  user?: OrgLinkedUser | null;
  type: OrgNodeType;
  name: string;
  role?: string | null;
  description?: string | null;
  icon?: string | null;
  colPosition: number;
  sortOrder: number;
  children?: OrgNode[];
}

export interface OrgAreaTree extends OrgArea {
  nodes: OrgNode[];
}

export interface OrgSearchResult {
  id: number;
  name: string;
  role?: string | null;
  type: OrgNodeType;
  user?: OrgLinkedUser | null;
  area: OrgArea;
  parent?: { name: string; type: OrgNodeType } | null;
}
