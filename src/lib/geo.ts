// Gadget Villa HQ (Bangkok) — replace with the real office coordinates.
export const OFFICE_LOCATION = { lat: 13.7563, lng: 100.5018 };
export const OFFICE_RADIUS_METERS = 500;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isWithinOffice(lat: number, lng: number): boolean {
  return haversineMeters({ lat, lng }, OFFICE_LOCATION) <= OFFICE_RADIUS_METERS;
}
