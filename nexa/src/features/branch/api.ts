import { api, type Envelope } from "@/lib/api/client";
import type { BranchRow, BranchCreateInput, BranchUpdateInput } from "./schema";

export function fetchBranches() {
  return api.get<Envelope<BranchRow[]>>("/api/branches");
}
export function createBranchApi(input: BranchCreateInput) {
  return api.post<Envelope<{ id: string }>>("/api/branches", input);
}
export function updateBranchApi(id: string, input: BranchUpdateInput) {
  return api.put<Envelope<{ id: string }>>(`/api/branches/${id}`, input);
}
export function deleteBranchApi(id: string) {
  return api.del<Envelope<{ id: string }>>(`/api/branches/${id}`);
}
