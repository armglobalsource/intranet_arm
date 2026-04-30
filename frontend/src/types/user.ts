export interface UserDepartment {
  id: number;
  name: string;
}

export interface UserRole {
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
  jobTitle?: string | null;
  bio?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  departmentId?: number | null;
  department?: UserDepartment | null;
  role?: UserRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  phone?: string;
  country?: string;
  bio?: string;
}
