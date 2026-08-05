"use client";

import { MapContainer, TileLayer, Circle, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#a3e635;border:3px solid #0a0a0a;box-shadow:0 0 0 4px rgba(163,230,53,0.35);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/**
 * Client-only confirmation preview shown before an ONSITE clock-in/out
 * submits — purely visual, the actual pass/fail geofence check still
 * happens server-side exactly as before. Must be loaded via
 * `dynamic(..., { ssr: false })` since Leaflet touches `window`.
 */
export function GeofenceMap({
  branchLat,
  branchLng,
  radiusMeters,
  userLat,
  userLng,
}: {
  branchLat: number;
  branchLng: number;
  radiusMeters: number;
  userLat: number;
  userLng: number;
}) {
  const center: [number, number] = [branchLat, branchLng];

  return (
    <div className="h-44 w-full overflow-hidden rounded-2xl">
      <MapContainer
        center={center}
        zoom={17}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Circle
          center={center}
          radius={radiusMeters}
          pathOptions={{ color: "#a3e635", weight: 2, fillColor: "#a3e635", fillOpacity: 0.15 }}
        />
        <Marker position={[userLat, userLng]} icon={userIcon} />
      </MapContainer>
    </div>
  );
}
