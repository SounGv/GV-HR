import { prisma } from "@/lib/prisma";
import { Unauthorized, BadRequest } from "@/lib/api/errors";
import { verifyPassword } from "./password";
import { signAccessToken, signMfaToken, verifyMfaToken, type AccessClaims } from "./jwt";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "./token-store";
import {
  generateSecret,
  buildOtpAuthUrl,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "./totp";
import type { GoogleProfile } from "./google-oauth";

// Constant dummy hash so a missing user still costs one bcrypt compare,
// equalizing response time and preventing user enumeration by timing.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3d0m0Q0k6Q0k6Q0k6Q0k6Q0k6Q0k6Qa";

export interface AuthMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  claims: AccessClaims;
  accessToken: string;
  refreshToken: string;
}

/** Prisma include that pulls the roles + permissions needed to build claims. */
const userWithRolesInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  employee: { select: { id: true } },
} as const;

function loadUserForClaims(id: string) {
  return prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
}

type UserWithRoles = NonNullable<Awaited<ReturnType<typeof loadUserForClaims>>>;

function buildClaims(user: UserWithRoles): AccessClaims {
  const roles = user.roles.map((ur) => ur.role.name);
  const perms = [
    ...new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key)),
    ),
  ];
  return {
    sub: user.id,
    companyId: user.companyId,
    email: user.email,
    roles,
    perms,
    employeeId: user.employee?.id,
  };
}

/** Finishes a login: bumps `lastLoginAt`, issues access + refresh tokens. */
async function completeLogin(user: UserWithRoles, meta?: AuthMeta): Promise<AuthResult> {
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const claims = buildClaims(user);
  const accessToken = await signAccessToken(claims);
  const refresh = await issueRefreshToken(user.id, meta);
  return { claims, accessToken, refreshToken: refresh.token };
}

export type LoginOutcome = ({ mfaRequired: false } & AuthResult) | { mfaRequired: true; mfaToken: string };

export async function login(
  email: string,
  password: string,
  meta?: AuthMeta,
): Promise<LoginOutcome> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    include: userWithRolesInclude,
  });

  // Always run a compare (real or dummy) to keep timing constant.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw Unauthorized("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (user.status === "DISABLED") {
    throw Unauthorized("บัญชีนี้ถูกระงับการใช้งาน");
  }

  if (user.twoFactorEnabled) {
    const mfaToken = await signMfaToken(user.id);
    return { mfaRequired: true, mfaToken };
  }

  const result = await completeLogin(user, meta);
  return { mfaRequired: false, ...result };
}

/** Second step of a 2FA-gated login: verifies the mfaToken + a TOTP or recovery code. */
export async function verifyMfaAndLogin(
  mfaToken: string,
  code: string,
  meta?: AuthMeta,
): Promise<AuthResult> {
  const mfaClaims = await verifyMfaToken(mfaToken);
  if (!mfaClaims) throw Unauthorized("เซสชันยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบใหม่");

  const user = await loadUserForClaims(mfaClaims.sub);
  if (!user || user.deletedAt || user.status === "DISABLED" || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw Unauthorized("ไม่สามารถยืนยันตัวตนได้");
  }

  if (!verifyTotp(user.twoFactorSecret, user.email, code)) {
    const codeHash = hashRecoveryCode(code);
    const recovery = await prisma.twoFactorRecoveryCode.findFirst({
      where: { userId: user.id, codeHash, usedAt: null },
      select: { id: true },
    });
    if (!recovery) throw Unauthorized("รหัสยืนยันไม่ถูกต้อง");
    await prisma.twoFactorRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
  }

  return completeLogin(user, meta);
}

export async function setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw Unauthorized();
  const secret = generateSecret();
  // Stored immediately but inert — twoFactorEnabled stays false until confirmed,
  // so an abandoned setup never actually gates login.
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  return { secret, otpauthUrl: buildOtpAuthUrl(secret, user.email) };
}

export async function confirmTwoFactor(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorSecret: true },
  });
  if (!user?.twoFactorSecret) throw BadRequest("กรุณาเริ่มตั้งค่า 2FA ก่อน");
  if (!verifyTotp(user.twoFactorSecret, user.email, code)) throw BadRequest("รหัสไม่ถูกต้อง");

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
    }),
  ]);
  return { recoveryCodes };
}

export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw BadRequest("ยังไม่ได้เปิดใช้งาน 2FA");

  let valid = verifyTotp(user.twoFactorSecret, user.email, code);
  if (!valid) {
    const codeHash = hashRecoveryCode(code);
    const recovery = await prisma.twoFactorRecoveryCode.findFirst({
      where: { userId, codeHash, usedAt: null },
      select: { id: true },
    });
    valid = !!recovery;
  }
  if (!valid) throw BadRequest("รหัสไม่ถูกต้อง");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
  ]);
}

/**
 * Google sign-in: matches an existing account by `googleId`, or by a
 * verified email (linking the Google identity on first use). Never creates a
 * brand-new account/organization — that still goes through /register.
 */
export async function loginWithGoogle(profile: GoogleProfile, meta?: AuthMeta): Promise<AuthResult> {
  if (!profile.email_verified) {
    throw Unauthorized("อีเมล Google ยังไม่ได้ยืนยัน");
  }
  const email = profile.email.toLowerCase().trim();

  let user = await prisma.user.findFirst({
    where: { googleId: profile.sub, deletedAt: null },
    include: userWithRolesInclude,
  });

  if (!user) {
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: userWithRolesInclude,
    });
    if (!existing) {
      throw Unauthorized("ไม่พบบัญชีนี้ในระบบ กรุณาสมัครใช้งานก่อน");
    }
    await prisma.user.update({ where: { id: existing.id }, data: { googleId: profile.sub } });
    user = existing;
  }

  if (user.status === "DISABLED") {
    throw Unauthorized("บัญชีนี้ถูกระงับการใช้งาน");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const claims = buildClaims(user);
  const accessToken = await signAccessToken(claims);
  const refresh = await issueRefreshToken(user.id, meta);
  return { claims, accessToken, refreshToken: refresh.token };
}

export async function refresh(rawRefreshToken: string, meta?: AuthMeta): Promise<AuthResult> {
  const rotated = await rotateRefreshToken(rawRefreshToken, meta);
  if (!rotated) throw Unauthorized("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");

  const user = await loadUserForClaims(rotated.userId);
  if (!user || user.deletedAt || user.status === "DISABLED") {
    throw Unauthorized("บัญชีไม่พร้อมใช้งาน");
  }

  const claims = buildClaims(user);
  const accessToken = await signAccessToken(claims);
  return { claims, accessToken, refreshToken: rotated.token };
}

export async function logout(rawRefreshToken: string | null): Promise<void> {
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
}
