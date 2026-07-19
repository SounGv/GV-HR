import { eq } from "drizzle-orm";
import { db } from "@db/index";
import { workplaces } from "@db/schema";
import { haversineMeters } from "./geo";

export interface WorkplaceVerifyResult {
  ok: boolean;
  error?: string;
  distance?: number;
  workplace?: { id: number; name: string; radiusMeters: number };
}

export async function verifyWorkplace(opts: {
  workplaceId: number;
  qrToken?: string;
  lat: number;
  lng: number;
}): Promise<WorkplaceVerifyResult> {
  const [wp] = await db.select().from(workplaces).where(eq(workplaces.id, opts.workplaceId)).limit(1);
  if (!wp) {
    return { ok: false, error: "ไม่พบสถานที่ทำงานนี้" };
  }
  if (opts.qrToken && opts.qrToken !== wp.qrToken) {
    return {
      ok: false,
      error: "QR Code ไม่ตรงกับสถานที่นี้",
      workplace: { id: wp.id, name: wp.name, radiusMeters: wp.radiusMeters },
    };
  }
  const distance = Math.round(haversineMeters({ lat: opts.lat, lng: opts.lng }, { lat: wp.lat, lng: wp.lng }));
  const within = distance <= wp.radiusMeters;
  return {
    ok: within,
    error: within ? undefined : `คุณอยู่นอกพื้นที่ ${wp.name} (ห่าง ${distance} ม. เกินรัศมี ${wp.radiusMeters} ม.)`,
    distance,
    workplace: { id: wp.id, name: wp.name, radiusMeters: wp.radiusMeters },
  };
}
