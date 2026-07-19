import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const { key } = await ctx.params;
  const store = getStore("leave-attachments");
  const decodedKey = decodeURIComponent(key);
  const result = await store.getWithMetadata(decodedKey, { type: "arrayBuffer" });
  if (!result) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  }

  const meta = result.metadata as { contentType?: string; fileName?: string } | undefined;
  return new NextResponse(result.data as ArrayBuffer, {
    headers: {
      "Content-Type": meta?.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${meta?.fileName || "attachment"}"`,
    },
  });
}
