"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { fullName } from "@/lib/format";
import { useUsers } from "./hooks";

export function UsersRoles() {
  const { data, isLoading, isError, refetch } = useUsers();
  const users = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={5} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>ผู้ใช้</TableHead>
            <TableHead>บทบาท</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">
                  {u.employee ? fullName(u.employee.firstName, u.employee.lastName) : u.email}
                </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.roleNames.length > 0 ? (
                    u.roleNames.map((n) => (
                      <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {n}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">— ไม่มีบทบาท —</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" render={<Link href={`/admin/users/${u.id}/roles`} />}>
                  แก้ไขบทบาท
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
