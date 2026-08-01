import { api, type Envelope } from "@/lib/api/client";
import type { CompanyProfile } from "./types";
import type { CompanyProfileInput } from "./schema";

export function fetchCompanyProfile() {
  return api.get<Envelope<CompanyProfile>>("/api/company");
}

export function updateCompanyProfileApi(input: CompanyProfileInput) {
  return api.put<Envelope<CompanyProfile>>("/api/company", input);
}
