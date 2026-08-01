import { z } from "zod";

export const geofenceSchema = z.object({
  branchId: z.string().min(1),
  lat: z.number().finite().min(-90).max(90).nullable(),
  lng: z.number().finite().min(-180).max(180).nullable(),
  radiusMeters: z.number().int().min(20, "รัศมีอย่างน้อย 20 เมตร").max(5000).nullable(),
});

export type GeofenceInput = z.infer<typeof geofenceSchema>;
