import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { Unauthorized } from "@/lib/api/errors";
import { hashPassword } from "./password";
import { revokeAllForUser } from "./token-store";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Always resolves the same way whether or not the email matches an account,
 * so the response can't be used to enumerate registered users.
 */
export async function requestPasswordReset(
  email: string,
  meta?: { ip?: string },
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: { id: true, email: true },
  });
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
      createdIp: meta?.ip,
    },
  });

  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "รีเซ็ตรหัสผ่าน NEXA",
    html: `
      <p>คุณได้ขอรีเซ็ตรหัสผ่านบัญชี NEXA ของคุณ</p>
      <p><a href="${url}">คลิกที่นี่เพื่อตั้งรหัสผ่านใหม่</a></p>
      <p>ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถละเว้นอีเมลนี้ได้</p>
    `,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw Unauthorized("ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  // Force re-login on every device once the password changes.
  await revokeAllForUser(row.userId);
}
