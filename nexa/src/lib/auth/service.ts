import { prisma } from "@/lib/prisma";
import { Unauthorized } from "@/lib/api/errors";
import { verifyPassword } from "./password";
import { signAccessToken, type AccessClaims } from "./jwt";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "./token-store";

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

export async function login(
  email: string,
  password: string,
  meta?: AuthMeta,
): Promise<AuthResult> {
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
