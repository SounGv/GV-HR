import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NAV_GROUPS } from "@/config/navigation";
import { sanitizeMenuPrefs, type MenuPrefs } from "./rules";

/**
 * Reads this person's saved sidebar layout. A missing or damaged value comes
 * back as the default layout, never as an error, so the sidebar always renders.
 *
 * @param userId The signed-in account (session.sub).
 */
export async function getMenuPrefs(userId: string): Promise<MenuPrefs> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { menuPrefs: true } });
  return sanitizeMenuPrefs(row?.menuPrefs, NAV_GROUPS);
}

/**
 * Saves the layout after cleaning it against the real menu. Only the caller's
 * own account is touched; ids the menu does not have are dropped.
 *
 * @param userId The signed-in account (session.sub).
 * @param input The layout as received from the request.
 * @returns The layout that was stored.
 */
export async function saveMenuPrefs(userId: string, input: unknown): Promise<MenuPrefs> {
  const clean = sanitizeMenuPrefs(input, NAV_GROUPS);
  await prisma.user.update({
    where: { id: userId },
    data: { menuPrefs: clean as unknown as Prisma.InputJsonValue, updatedById: userId },
  });
  return clean;
}

/** Clears the saved layout so the account goes back to the default menu. */
export async function resetMenuPrefs(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { menuPrefs: Prisma.DbNull, updatedById: userId } });
}
