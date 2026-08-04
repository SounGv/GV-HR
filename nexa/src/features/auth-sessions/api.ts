import { api, type Envelope } from "@/lib/api/client";
import type { SessionRow } from "./types";

export function fetchSessions() {
  return api.get<Envelope<SessionRow[]>>("/api/auth/sessions");
}

export function revokeSession(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/auth/sessions/${id}`);
}

export function revokeOtherSessions() {
  return api.post<Envelope<{ ok: true }>>("/api/auth/sessions/revoke-others");
}
