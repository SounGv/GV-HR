import { getSession } from "./session";
import { prisma } from "@/lib/prisma";
import { avatarSrc } from "@/lib/avatar";

export interface CurrentUser {
  id: string;
  email: string | null;
  username: string | null;
  companyId: string;
  /** No logo here: it is stored as a ~365 KB data URL and would be sent with every page. The payslip loads it itself. */
  company: { id: string; name: string } | null;
  roles: string[];
  permissions: string[];
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    avatarUrl: string | null;
    status: string;
    department: { id: string; name: string } | null;
    position: { id: string; title: string } | null;
  } | null;
}

/** Server-side current-user profile used by the app shell / server components. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      username: true,
      companyId: true,
      company: { select: { id: true, name: true } },
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          nickname: true,
          avatarUrl: true,
          status: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    companyId: user.companyId,
    company: user.company,
    roles: session.roles,
    permissions: session.perms,
    // The photo goes by its short address: stored inline it would be sent with every page.
    employee: user.employee
      ? { ...user.employee, avatarUrl: avatarSrc(user.employee.id, user.employee.avatarUrl) ?? null }
      : null,
  };
}
