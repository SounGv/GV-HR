"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCompanyProfile, updateCompanyProfileApi } from "./api";
import type { CompanyProfileInput } from "./schema";

export const companyKeys = {
  profile: ["company", "profile"] as const,
};

export function useCompanyProfile() {
  return useQuery({ queryKey: companyKeys.profile, queryFn: fetchCompanyProfile });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanyProfileInput) => updateCompanyProfileApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyKeys.profile }),
  });
}
