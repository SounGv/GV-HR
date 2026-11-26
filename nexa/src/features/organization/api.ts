import { api, type Envelope } from "@/lib/api/client";
import type {
  DepartmentRow,
  OrgPersonRow,
  PositionRow,
  DepartmentFormValues,
  PositionFormValues,
} from "./types";
import type { OrgMove } from "./org-tree";

export function fetchDepartments() {
  return api.get<Envelope<DepartmentRow[]>>("/api/org/departments");
}
export function fetchOrgPeople() {
  return api.get<Envelope<OrgPersonRow[]>>("/api/org/people");
}
/** Org chart edit mode: save new department + manager placements (HR / admin). */
export function saveOrgMoves(moves: OrgMove[]) {
  return api.post<Envelope<{ updated: number }>>("/api/org/moves", { moves });
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

export interface PositionDetail {
  id: string;
  title: string;
  code: string;
  level: number;
  departmentId: string | null;
  duties: { id: string; title: string; description: string | null; order: number }[];
}

export function fetchPosition(id: string) {
  return api.get<Envelope<PositionDetail>>(`/api/org/positions/${id}`);
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
