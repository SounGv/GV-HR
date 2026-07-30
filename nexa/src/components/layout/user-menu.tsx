"use client";

import { LogOut, User as UserIcon, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials } from "@/lib/format";

export function UserMenu() {
  const { user, logout } = useAuth();
  const emp = user.employee;
  const name = emp ? fullName(emp.firstName, emp.lastName) : user.email;
  const role = user.roles[0] ?? "ผู้ใช้งาน";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2" />}
      >
        <>
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
          <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
        </>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/profile" />}>
          <UserIcon className="size-4" />
          โปรไฟล์ของฉัน
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOut className="size-4" />
          ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
