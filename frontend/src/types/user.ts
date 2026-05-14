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

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  country?: string | null;
  bio?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  departmentId?: number | null;
  campusId?: number | null;
  department?: UserDepartment | null;
  campus?: UserCampus | null;
  role?: UserRole | null;
  jobTitles: { jobTitle: UserJobTitle }[];
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
  status?:      'active' | 'inactive' | 'suspended';
}

/** Extrae los nombres de cargos de un usuario */
export function userJobTitleNames(u: Pick<User, 'jobTitles'>): string[] {
  return u.jobTitles.map((jt) => jt.jobTitle.name);
}

/** Primer cargo como string, o null */
export function primaryJobTitle(u: Pick<User, 'jobTitles'>): string | null {
  return u.jobTitles[0]?.jobTitle.name ?? null;
}
