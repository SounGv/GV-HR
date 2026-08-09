import { api, type Envelope } from "@/lib/api/client";

export function changePassword(currentPassword: string, newPassword: string) {
  return api.post<Envelope<{ ok: true }>>("/api/auth/change-password", { currentPassword, newPassword });
}
