import { api, type Envelope } from "@/lib/api/client";
import type { FormDetail, FormListItem } from "./types";

export interface FormSavePayload {
  name?: string;
  description?: string | null;
  questions?: {
    text: string;
    helpText?: string | null;
    answerType: string;
    options?: { value: string; label: string }[] | null;
    weight: number;
    required: boolean;
    visibleTo: string[];
  }[];
}

export const fetchForms = () => api.get<Envelope<FormListItem[]>>("/api/appraisal-forms");
export const fetchForm = (id: string) => api.get<Envelope<FormDetail>>(`/api/appraisal-forms/${id}`);
export const createForm = (name: string) => api.post<Envelope<{ id: string }>>("/api/appraisal-forms", { name });
export const saveForm = (id: string, input: FormSavePayload) =>
  api.patch<Envelope<{ id: string }>>(`/api/appraisal-forms/${id}`, input);
export const publishForm = (id: string) => api.post<Envelope<{ id: string }>>(`/api/appraisal-forms/${id}/publish`);
export const newFormVersion = (id: string) =>
  api.post<Envelope<{ id: string }>>(`/api/appraisal-forms/${id}/new-version`);
export const deleteForm = (id: string) => api.del<Envelope<{ ok: true }>>(`/api/appraisal-forms/${id}`);
