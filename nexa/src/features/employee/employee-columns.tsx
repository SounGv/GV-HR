"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CharacterAvatar, characterFor } from "@/components/shared/character-avatar";
import { fullName, formatDate } from "@/lib/format";
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
              <AvatarFallback className="bg-transparent p-0">
                <CharacterAvatar character={characterFor({ gender: e.gender ?? null })} seed={e.id} className="size-full" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-[160px]">
              <div className="font-medium break-words whitespace-normal text-foreground">
                <Link href={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="hover:text-primary hover:underline">
                  {fullName(e.firstName, e.lastName)}
                </Link>
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
          <div className="min-w-[160px] max-w-[220px] text-sm whitespace-normal break-words" title={v}>
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
          <div className="min-w-[160px] max-w-[220px] text-sm whitespace-normal break-words" title={v}>
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
        <span className="text-sm tabular-nums">{formatDate(row.original.hireDate)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "สถานะ",
      cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "จัดการ",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        const name = fullName(e.firstName, e.lastName);
        return (
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="icon" className="size-9" aria-label={`ดูรายละเอียด ${name}`} onClick={(ev) => { ev.stopPropagation(); handlers.onView(e); }}>
              <Eye className="size-4" />
            </Button>
            {handlers.canEdit && (
              <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${name}`} onClick={(ev) => { ev.stopPropagation(); handlers.onEdit(e); }}>
                <Pencil className="size-4" />
              </Button>
            )}
            {handlers.canDelete && (
              <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`ลบ ${name}`} onClick={(ev) => { ev.stopPropagation(); handlers.onDelete(e); }}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
