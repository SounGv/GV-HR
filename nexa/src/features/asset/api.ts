import { api, type Envelope } from "@/lib/api/client";
import type { Asset, AssetFormValues, AssetStatus } from "./types";

export function fetchAssets(status?: AssetStatus, search?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  return api.get<Envelope<Asset[]>>(`/api/assets${qs ? `?${qs}` : ""}`);
}

export function createAsset(input: AssetFormValues) {
  return api.post<Envelope<Asset>>("/api/assets", input);
}

export function updateAsset(id: string, input: Partial<AssetFormValues>) {
  return api.patch<Envelope<Asset>>(`/api/assets/${id}`, input);
}

export function deleteAsset(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/assets/${id}`);
}

export function assignAsset(id: string, employeeId: string | null) {
  return api.post<Envelope<Asset>>(`/api/assets/${id}/assign`, { employeeId });
}
