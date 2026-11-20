"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A small map made of OpenStreetMap tiles laid out by hand (no map library, so nothing heavy to ship): Web Mercator, 256px tiles.
 * It draws a branch circle (`fence`), the branch pin, the person's dot and a line between two points on top of the tiles.
 * Loading tiles tells the tile server roughly where the phone is (street level); the attribution link is required by their terms.
 * With no network the tiles stay blank, but the circle, dots and line are still placed correctly.
 */

const TILE = 256;
const MIN_Z = 12;
const MAX_Z = 19;

export interface LatLng {
  lat: number;
  lng: number;
}

const worldX = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};
/** Metres covered by one pixel at this latitude and zoom. */
const metresPerPixel = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

export function TileMap({
  center,
  zoom = 18,
  fitPoints,
  fence,
  pin,
  me,
  line,
  insets,
  interactive = false,
  className,
  children,
}: {
  center: LatLng;
  zoom?: number;
  /** Pick the closest zoom that keeps all these points in view (overrides `zoom`). */
  fitPoints?: LatLng[];
  fence?: { at: LatLng; radius: number; outside?: boolean };
  pin?: LatLng;
  me?: LatLng;
  line?: [LatLng, LatLng];
  /** Pixels at the top and bottom that a header or a sheet covers; the subject is kept in the part that stays visible. */
  insets?: { top: number; bottom: number };
  /** Drag to move, plus and minus buttons. */
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dz, setDz] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const insetTop = insets?.top ?? 0;
  const insetBottom = insets?.bottom ?? 0;
  // Moving the centre point down in the world moves the subject up on screen, into the strip the sheet leaves free.
  const offsetY = (insetBottom - insetTop) / 2;

  // A few iterations at most, so no memo (the points array is a new object on every render anyway).
  const baseZoom = (() => {
    if (!fitPoints || fitPoints.length < 2 || !size.w) return zoom;
    const padX = 70;
    const padY = 70 + insetTop + insetBottom;
    for (let z = Math.min(zoom, MAX_Z); z >= MIN_Z; z--) {
      const xs = fitPoints.map((p) => worldX(p.lng, z));
      const ys = fitPoints.map((p) => worldY(p.lat, z));
      if (Math.max(...xs) - Math.min(...xs) <= size.w - padX && Math.max(...ys) - Math.min(...ys) <= size.h - padY) return z;
    }
    return MIN_Z;
  })();

  const z = Math.min(MAX_Z, Math.max(MIN_Z, baseZoom + dz));
  const cx = worldX(center.lng, z) - pan.x;
  const cy = worldY(center.lat, z) - pan.y + offsetY;
  const left = cx - size.w / 2;
  const top = cy - size.h / 2;
  const at = (p: LatLng) => ({ x: worldX(p.lng, z) - left, y: worldY(p.lat, z) - top });

  const tiles: { x: number; y: number; key: string }[] = [];
  if (size.w) {
    const n = 2 ** z;
    for (let x = Math.floor(left / TILE); x <= Math.floor((left + size.w) / TILE); x++) {
      for (let y = Math.floor(top / TILE); y <= Math.floor((top + size.h) / TILE); y++) {
        if (y < 0 || y >= n) continue;
        tiles.push({ x, y, key: `${z}/${x}/${y}` });
      }
    }
  }

  function changeZoom(delta: number) {
    const next = Math.min(MAX_Z, Math.max(MIN_Z, z + delta));
    if (next === z) return;
    const factor = 2 ** (next - z);
    setPan((p) => ({ x: p.x * factor, y: p.y * factor }));
    setDz(next - baseZoom);
  }

  const fenceBox = fence ? at(fence.at) : null;
  const fenceSize = fence ? (2 * fence.radius) / metresPerPixel(fence.at.lat, z) : 0;
  const lineA = line ? at(line[0]) : null;
  const lineB = line ? at(line[1]) : null;
  const pinAt = pin ? at(pin) : null;
  const meAt = me ? at(me) : null;

  return (
    <div
      ref={box}
      className={cn("relative isolate overflow-hidden bg-[#dfe9e6] dark:bg-[#1b2524]", interactive && "touch-none", className)}
      onPointerDown={
        interactive
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e) => {
              const d = drag.current;
              if (d) setPan({ x: d.px - (e.clientX - d.x), y: d.py - (e.clientY - d.y) });
            }
          : undefined
      }
      onPointerUp={interactive ? () => (drag.current = null) : undefined}
      onPointerCancel={interactive ? () => (drag.current = null) : undefined}
    >
      <div className="gv-tiles absolute inset-0">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- map tiles come from the tile server in their own sizes
          <img
            key={t.key}
            alt=""
            draggable={false}
            decoding="async"
            src={`https://tile.openstreetmap.org/${z}/${((t.x % 2 ** z) + 2 ** z) % 2 ** z}/${t.y}.png`}
            style={{ left: t.x * TILE - left, top: t.y * TILE - top }}
            className="absolute size-[256px] max-w-none select-none"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {fenceBox && (
          <span
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              fence?.outside ? "border-dashed border-[#b42318] bg-[#b42318]/10" : "border-[#1976d2] bg-[#1976d2]/15",
            )}
            style={{ left: fenceBox.x, top: fenceBox.y, width: fenceSize, height: fenceSize }}
          />
        )}
        {lineA && lineB && (
          <span
            className="absolute h-[3px] origin-left rounded-full bg-[#b42318]/90"
            style={{
              left: lineA.x,
              top: lineA.y,
              width: Math.hypot(lineB.x - lineA.x, lineB.y - lineA.y),
              transform: `rotate(${(Math.atan2(lineB.y - lineA.y, lineB.x - lineA.x) * 180) / Math.PI}deg)`,
            }}
          />
        )}
        {pinAt && (
          <svg viewBox="0 0 24 24" className="absolute size-[30px] -translate-x-1/2 -translate-y-full drop-shadow-md" style={{ left: pinAt.x, top: pinAt.y }} aria-hidden="true">
            <path d="M12 22s7.5-6.4 7.5-12A7.5 7.5 0 0 0 4.5 10c0 5.6 7.5 12 7.5 12Z" fill="#1565c0" stroke="#fff" strokeWidth="1.6" />
            <circle cx="12" cy="10" r="3" fill="#fff" />
          </svg>
        )}
        {meAt && (
          <span className="absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#1565c0] shadow-md" style={{ left: meAt.x, top: meAt.y }}>
            <span className="absolute -inset-3.5 animate-ping rounded-full bg-[#1565c0]/25 motion-reduce:animate-none" />
          </span>
        )}
      </div>

      {children}

      {interactive && (
        <div onPointerDown={(e) => e.stopPropagation()} className="absolute top-[40%] right-3.5 z-10 flex flex-col overflow-hidden rounded-full bg-white/90 text-[#1565c0] shadow-lg">
          <button type="button" onClick={() => changeZoom(1)} className="flex size-11 items-center justify-center" aria-label="ขยายแผนที่">
            <Plus className="size-5" />
          </button>
          <button type="button" onClick={() => changeZoom(-1)} className="flex size-11 items-center justify-center border-t border-black/10" aria-label="ย่อแผนที่">
            <Minus className="size-5" />
          </button>
        </div>
      )}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        style={{ bottom: insetBottom + 6 }}
        className="absolute right-2 z-10 rounded-md bg-white/80 px-1.5 py-px text-xs text-[#333]"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
