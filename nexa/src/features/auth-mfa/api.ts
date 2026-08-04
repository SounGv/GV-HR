import { api, type Envelope } from "@/lib/api/client";
import type { MfaConfirmResponse, MfaSetupResponse, MfaStatus } from "./types";

export function fetchMfaStatus() {
  return api.get<Envelope<MfaStatus>>("/api/auth/mfa/status");
}

export function setupMfa() {
  return api.post<Envelope<MfaSetupResponse>>("/api/auth/mfa/setup");
}

export function confirmMfa(code: string) {
  return api.post<Envelope<MfaConfirmResponse>>("/api/auth/mfa/confirm", { code });
}

export function disableMfa(code: string) {
  return api.post<Envelope<{ ok: true }>>("/api/auth/mfa/disable", { code });
}
