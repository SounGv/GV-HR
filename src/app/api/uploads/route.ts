import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { requireSession, isSession } from "@/lib/api-helpers";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 10MB" }, { status: 413 });
  }

  const key = `${session.employeeId}/${Date.now()}-${file.name}`;
  const store = getStore("leave-attachments");
  await store.set(key, await file.arrayBuffer(), {
    metadata: { contentType: file.type, fileName: file.name, uploadedBy: session.employeeId },
  });

  return NextResponse.json({ ok: true, key, fileName: file.name, url: `/api/uploads/${encodeURIComponent(key)}` });
}
