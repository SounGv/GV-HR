import { api, type Envelope } from "@/lib/api/client";
import type { GeofenceInput } from "./schema";

export interface Geofence {
  id: string;
  name: string;
  code: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
}

export function fetchGeofences() {
  return api.get<Envelope<Geofence[]>>("/api/attendance/geofence");
}

export function updateGeofenceApi(input: GeofenceInput) {
  return api.put<Envelope<Geofence>>("/api/attendance/geofence", input);
}
