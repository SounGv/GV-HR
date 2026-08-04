import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { upsertCompetencyByName } from "@/features/competency/service";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        description: z.string().trim().max(2000).optional(),
        weight: z.coerce.number().int().min(1).max(5),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const { items } = bodySchema.parse(await request.json());

    const results = [];
    for (const item of items) {
      const competency = await upsertCompetencyByName(session.companyId, session, item.name, item.description);
      results.push({ competencyId: competency.id, name: competency.name, weight: item.weight });
    }

    return ok(results);
  } catch (error) {
    return handleApiError(error);
  }
}
