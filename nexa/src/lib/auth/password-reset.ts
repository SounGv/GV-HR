import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { runAfterResponse } from "@/lib/after-response";
import { Unauthorized } from "@/lib/api/errors";
import { hashPassword } from "./password";
import { revokeAllForUser } from "./token-store";
import { appBaseUrl } from "@/lib/app-url";

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
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true },
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

  const url = `${appBaseUrl()}/reset-password?token=${token}`;
  // Sent after the response: waiting on the mail server (or its failure) would make a known address answer
  // slower or with an error, which tells a caller which emails have accounts.
  await runAfterResponse(() =>
    sendEmail({
      to: normalized,
      subject: "รีเซ็ตรหัสผ่าน GV One",
      html: `
      <p>คุณได้ขอรีเซ็ตรหัสผ่านบัญชี GV One ของคุณ</p>
      <p><a href="${url}">คลิกที่นี่เพื่อตั้งรหัสผ่านใหม่</a></p>
      <p>ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถละเว้นอีเมลนี้ได้</p>
    `,
    }).catch((err) => console.error("[password-reset] send failed", err)),
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw Unauthorized("ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
  }

  const passwordHash = await hashPassword(newPassword);
  // Claim the token first (only while unused) so two requests with the same link cannot both set a password.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw Unauthorized("ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
  });

  // Force re-login on every device once the password changes.
  await revokeAllForUser(row.userId);
}
