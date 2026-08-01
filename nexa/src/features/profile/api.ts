import { api, type Envelope } from "@/lib/api/client";
import type { MyProfile } from "./types";
import type { SelfProfileInput } from "./schema";

export function fetchMyProfile() {
  return api.get<Envelope<MyProfile>>("/api/profile");
}

export function updateMyProfileApi(input: SelfProfileInput) {
  return api.put<Envelope<MyProfile>>("/api/profile", input);
}
