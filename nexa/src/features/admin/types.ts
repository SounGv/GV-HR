export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
  userCount: number;
}

export type AiAccessScope = "TEAM" | "DEPARTMENT" | "COMPANY";

export interface AdminUser {
  id: string;
  email: string;
  status: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  aiAccessScope: AiAccessScope | null;
  roleIds: string[];
  roleNames: string[];
}

export interface RoleFormValues {
  name: string;
  description?: string;
  permissions: string[];
}
