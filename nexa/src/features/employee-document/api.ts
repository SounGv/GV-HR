import { api, type Envelope } from "@/lib/api/client";
import type { EmployeeDocumentCreateInput } from "./schema";
import type { EmployeeDocumentItem } from "./types";

export function fetchEmployeeDocuments(employeeId: string) {
  return api.get<Envelope<EmployeeDocumentItem[]>>(`/api/employees/${employeeId}/documents`);
}

export function addEmployeeDocument(employeeId: string, input: EmployeeDocumentCreateInput) {
  return api.post<Envelope<EmployeeDocumentItem>>(`/api/employees/${employeeId}/documents`, input);
}

export function removeEmployeeDocument(employeeId: string, documentId: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/employees/${employeeId}/documents/${documentId}`);
}
