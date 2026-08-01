"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fullName, getInitials, formatDate } from "@/lib/format";
import type { EmployeeListItem } from "./types";
import { EmployeeStatusBadge } from "./status-badge";
import { EMPLOYMENT_LABEL } from "./labels";

interface ColumnHandlers {
  onView: (row: EmployeeListItem) => void;
  onEdit: (row: EmployeeListItem) => void;
  onDelete: (row: EmployeeListItem) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function getEmployeeColumns(handlers: ColumnHandlers): ColumnDef<EmployeeListItem>[] {
  return [
    {
      accessorKey: "firstName",
      header: "พนักงาน",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {e.avatarUrl && <AvatarImage src={e.avatarUrl} alt={e.firstName} />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(e.firstName, e.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {fullName(e.firstName, e.lastName)}
                {e.nickname && (
                  <span className="ml-1 text-muted-foreground">({e.nickname})</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{e.employeeCode}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: "department",
      header: "แผนก",
      enableSorting: false,
      cell: ({ row }) => {
        const v = row.original.department?.name ?? "-";
        return (
          <div className="max-w-[180px] truncate text-sm" title={v}>
            {v}
          </div>
        );
      },
    },
    {
      id: "position",
      header: "ตำแหน่ง",
      enableSorting: false,
      cell: ({ row }) => {
        const v = row.original.position?.title ?? "-";
        return (
          <div className="max-w-[180px] truncate text-sm" title={v}>
            {v}
          </div>
        );
      },
    },
    {
      id: "employmentType",
      header: "ประเภท",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {EMPLOYMENT_LABEL[row.original.employmentType]}
        </span>
      ),
    },
    {
      accessorKey: "hireDate",
      header: "วันเริ่มงาน",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.hireDate)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "สถานะ",
      cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="เมนู"
                    onClick={(ev) => ev.stopPropagation()}
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(ev) => ev.stopPropagation()}>
                <DropdownMenuItem onClick={() => handlers.onView(e)}>
                  <Eye className="size-4" /> ดูรายละเอียด
                </DropdownMenuItem>
                {handlers.canEdit && (
                  <DropdownMenuItem onClick={() => handlers.onEdit(e)}>
                    <Pencil className="size-4" /> แก้ไข
                  </DropdownMenuItem>
                )}
                {handlers.canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => handlers.onDelete(e)}>
                      <Trash2 className="size-4" /> ลบ
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
