"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeFormSheet } from "./employee-form-sheet";
import type { EmployeeDetail } from "./types";

/** Opens the edit sheet pre-filled for a single employee (used on the detail page). */
export function EditEmployeeButton({ employee }: { employee: EmployeeDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> แก้ไข
      </Button>
      <EmployeeFormSheet open={open} onOpenChange={setOpen} employee={open ? employee : null} />
    </>
  );
}
