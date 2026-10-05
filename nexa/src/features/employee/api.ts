import { api, type Envelope, type PaginatedEnvelope } from "@/lib/api/client";
import type {
  EmployeeDetail,
  EmployeeFormValues,
  EmployeeListItem,
  EmployeeQuery,
  OrgOptions,
} from "./types";

function toQueryString(q: EmployeeQuery): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    // departmentId is multi-select (string[]) — repeated keys, not a single
    // comma-joined value, so the API route's `getAll` picks up every id.
    if (Array.isArray(v)) {
      for (const item of v) params.append(k, String(item));
    } else {
      params.set(k, String(v));
    }
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function fetchEmployees(query: EmployeeQuery) {
  return api.get<PaginatedEnvelope<EmployeeListItem>>(`/api/employees${toQueryString(query)}`);
}

export function fetchEmployee(id: string) {
  return api.get<Envelope<EmployeeDetail>>(`/api/employees/${id}`);
}

export function createEmployee(input: EmployeeFormValues) {
  return api.post<Envelope<EmployeeDetail>>("/api/employees", input);
}

export function updateEmployee(id: string, input: Partial<EmployeeFormValues>) {
  return api.patch<Envelope<EmployeeDetail>>(`/api/employees/${id}`, input);
}

export function deleteEmployee(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/employees/${id}`);
}

export function fetchOrgOptions() {
  return api.get<Envelope<OrgOptions>>("/api/org/options");
}
