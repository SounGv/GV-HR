import { api, type Envelope } from "@/lib/api/client";
import type {
  AiTemplateDesignerRequest,
  AiTemplateDesignerResponse,
  TemplateDetail,
  TemplateFormValues,
  TemplateListItem,
} from "./types";

export function fetchTemplates(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return api.get<Envelope<TemplateListItem[]>>(`/api/evaluation-templates${qs}`);
}

export function fetchTemplate(id: string) {
  return api.get<Envelope<TemplateDetail>>(`/api/evaluation-templates/${id}`);
}

export function createTemplate(input: TemplateFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/evaluation-templates", input);
}

export function updateTemplate(id: string, input: Partial<TemplateFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/evaluation-templates/${id}`, input);
}

export function deleteTemplate(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/evaluation-templates/${id}`);
}

export function generateAiTemplateDesign(input: AiTemplateDesignerRequest) {
  return api.post<Envelope<AiTemplateDesignerResponse>>("/api/ai/template-designer", input);
}
