"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGeofences, updateGeofenceApi } from "./api";
import type { GeofenceInput } from "./schema";

export const geofenceKeys = { all: ["geofence"] as const };

export function useGeofences() {
  return useQuery({ queryKey: geofenceKeys.all, queryFn: fetchGeofences });
}

export function useUpdateGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GeofenceInput) => updateGeofenceApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: geofenceKeys.all }),
  });
}
