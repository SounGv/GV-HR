export type EmployeeDocumentType = "ID_CARD" | "DEGREE" | "CONTRACT" | "WORK_PERMIT" | "OTHER";

export interface EmployeeDocumentItem {
  id: string;
  type: EmployeeDocumentType;
  label: string;
  fileUrl: string;
  uploadedAt: string;
}
