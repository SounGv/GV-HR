"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRole,
  deleteRole,
  fetchRoles,
  fetchUsers,
  setUserRoles,
  updateRole,
} from "./api";
import type { RoleFormValues } from "./types";

export const adminKeys = {
  roles: ["admin", "roles"] as const,
  users: ["admin", "users"] as const,
};

export function useRoles() {
  return useQuery({ queryKey: adminKeys.roles, queryFn: fetchRoles });
}

export function useUsers() {
  return useQuery({ queryKey: adminKeys.users, queryFn: fetchUsers });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RoleFormValues) => createRole(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.roles }),
  });
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RoleFormValues>) => updateRole(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.roles }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.roles }),
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; roleIds: string[] }) => setUserRoles(v.id, v.roleIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users }),
  });
}
