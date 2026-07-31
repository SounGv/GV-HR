import { api, type Envelope } from "@/lib/api/client";
import type {
  DepartmentRow,
  PositionRow,
  DepartmentFormValues,
  PositionFormValues,
} from "./types";

export function fetchDepartments() {
  return api.get<Envelope<DepartmentRow[]>>("/api/org/departments");
}
export function createDepartment(input: DepartmentFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/org/departments", input);
}
export function updateDepartment(id: string, input: Partial<DepartmentFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/org/departments/${id}`, input);
}
export function deleteDepartment(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/org/departments/${id}`);
}

export function fetchPositions() {
  return api.get<Envelope<PositionRow[]>>("/api/org/positions");
}
export function createPosition(input: PositionFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/org/positions", input);
}
export function updatePosition(id: string, input: Partial<PositionFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/org/positions/${id}`, input);
}
export function deletePosition(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/org/positions/${id}`);
}
