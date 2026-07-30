/** Geospatial helpers for attendance geofencing. */

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle (haversine) distance in metres between two coordinates. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface GeofenceResult {
  distance: number;
  withinRadius: boolean;
}

/** Check whether a point lies within `radiusMeters` of a branch centre. */
export function checkGeofence(
  point: { lat: number; lng: number },
  branch: { lat: number; lng: number; radiusMeters: number },
): GeofenceResult {
  const distance = distanceMeters(point.lat, point.lng, branch.lat, branch.lng);
  return { distance, withinRadius: distance <= branch.radiusMeters };
}

/** Valid finite latitude/longitude. */
export function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
