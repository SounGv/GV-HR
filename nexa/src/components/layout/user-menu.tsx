"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials } from "@/lib/format";
import { useProfileDrawer } from "./profile-drawer-context";

/** Desktop entry point for the account drawer — same drawer the mobile bottom
 * nav and mobile home header open, just a different trigger button. */
export function UserMenu() {
  const { user } = useAuth();
  const { openDrawer } = useProfileDrawer();
  const emp = user.employee;
  const name = emp ? fullName(emp.firstName, emp.lastName) : user.email;
  const role = user.roles[0] ?? "ผู้ใช้งาน";

  return (
    <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2" onClick={openDrawer} aria-label="เปิดเมนูโปรไฟล์">
      <Avatar className="size-7">
        {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={name} />}
        <AvatarFallback className="bg-primary/10 text-xs text-primary">
          {getInitials(emp?.firstName, emp?.lastName)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden text-left sm:block">
        <span className="block text-sm leading-tight font-medium">{name}</span>
        <span className="block text-xs leading-tight text-muted-foreground">{role}</span>
      </span>
    </Button>
  );
}
