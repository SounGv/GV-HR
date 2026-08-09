import { api, type Envelope } from "@/lib/api/client";
import type { MyProfile } from "./types";
import type { SelfProfileInput } from "./schema";

export function fetchMyProfile() {
  return api.get<Envelope<MyProfile>>("/api/profile");
}

export function updateMyProfileApi(input: SelfProfileInput) {
  return api.put<Envelope<MyProfile>>("/api/profile", input);
}

export function generateLineLinkCode() {
  return api.post<Envelope<{ code: string; expiresAt: string }>>("/api/profile/line/link-code");
}

export function unlinkLine() {
  return api.del<Envelope<{ ok: true }>>("/api/profile/line");
}
