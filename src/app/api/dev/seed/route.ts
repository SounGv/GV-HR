import { NextResponse } from "next/server";
import { db } from "@db/index";
import { employees } from "@db/schema";
import { runSeed } from "@db/seed";

// One-time, secret-gated seeding endpoint for a freshly provisioned database.
// Requires SEED_SECRET to be set in the environment and passed back as a
// header — there is no other way to trigger this route.
export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEED_SECRET ยังไม่ได้ตั้งค่าในระบบ" }, { status: 501 });
  }
  if (req.headers.get("x-seed-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await db.select().from(employees).limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "ฐานข้อมูลมีข้อมูลอยู่แล้ว ไม่สามารถ seed ซ้ำได้" },
      { status: 409 }
    );
  }

  try {
    const log = await runSeed();
    return NextResponse.json({ ok: true, log });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "seed ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
