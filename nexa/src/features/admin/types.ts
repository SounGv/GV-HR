export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
  userCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  status: string;
  employee: { firstName: string; lastName: string; employeeCode: string } | null;
  roleIds: string[];
  roleNames: string[];
}

export interface RoleFormValues {
  name: string;
  description?: string;
  permissions: string[];
}
