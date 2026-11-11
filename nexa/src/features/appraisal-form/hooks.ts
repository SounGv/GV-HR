"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createForm, deleteForm, fetchBank, fetchForm, fetchForms, newFormVersion, publishForm, removeBankItem, saveForm, type FormSavePayload } from "./api";

export const appraisalFormKeys = {
  all: ["appraisal-forms"] as const,
  list: ["appraisal-forms", "list"] as const,
  detail: (id: string) => ["appraisal-forms", "detail", id] as const,
  bank: ["appraisal-forms", "bank"] as const,
};

export function useAppraisalForms() {
  return useQuery({ queryKey: appraisalFormKeys.list, queryFn: fetchForms, placeholderData: (prev) => prev });
}

export function useAppraisalForm(id: string) {
  return useQuery({ queryKey: appraisalFormKeys.detail(id), queryFn: () => fetchForm(id) });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: appraisalFormKeys.all });
}

export function useCreateAppraisalForm() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (name: string) => createForm(name), onSuccess: invalidate });
}

export function useSaveAppraisalForm(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: FormSavePayload) => saveForm(id, input), onSuccess: invalidate });
}

export function usePublishAppraisalForm(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => publishForm(id), onSuccess: invalidate });
}

export function useNewAppraisalFormVersion(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => newFormVersion(id), onSuccess: invalidate });
}

export function useDeleteAppraisalForm() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteForm(id), onSuccess: invalidate });
}

/** The question bank (คลังหัวข้อ), loaded only when the picker opens. */
export function useQuestionBank(enabled: boolean) {
  return useQuery({ queryKey: appraisalFormKeys.bank, queryFn: fetchBank, enabled, staleTime: 60_000 });
}

export function useRemoveBankItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => removeBankItem(id), onSuccess: () => qc.invalidateQueries({ queryKey: appraisalFormKeys.bank }) });
}
