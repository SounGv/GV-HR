import { api, type Envelope } from "@/lib/api/client";
import type { CostCenterRow, CostCenterCreateInput, CostCenterUpdateInput } from "./schema";

export function fetchCostCenters() {
  return api.get<Envelope<CostCenterRow[]>>("/api/cost-centers");
}
export function createCostCenterApi(input: CostCenterCreateInput) {
  return api.post<Envelope<{ id: string }>>("/api/cost-centers", input);
}
export function updateCostCenterApi(id: string, input: CostCenterUpdateInput) {
  return api.put<Envelope<{ id: string }>>(`/api/cost-centers/${id}`, input);
}
export function deleteCostCenterApi(id: string) {
  return api.del<Envelope<{ id: string }>>(`/api/cost-centers/${id}`);
}
