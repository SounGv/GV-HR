import { api, type Envelope } from "@/lib/api/client";
import type { AdminRole, AdminUser, AiAccessScope, RoleFormValues } from "./types";

export function fetchRoles() {
  return api.get<Envelope<AdminRole[]>>("/api/admin/roles");
}

export function createRole(input: RoleFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/admin/roles", input);
}

export function updateRole(id: string, input: Partial<RoleFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/admin/roles/${id}`, input);
}

export function deleteRole(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/admin/roles/${id}`);
}

export function fetchUsers() {
  return api.get<Envelope<AdminUser[]>>("/api/admin/users");
}

export function setUserRoles(id: string, roleIds: string[]) {
  return api.put<Envelope<{ ok: true }>>(`/api/admin/users/${id}/roles`, { roleIds });
}

export function setAiAccessGrant(id: string, scope: AiAccessScope) {
  return api.put<Envelope<{ ok: true }>>(`/api/admin/users/${id}/ai-access`, { scope });
}

export function revokeAiAccessGrant(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/admin/users/${id}/ai-access`);
}
