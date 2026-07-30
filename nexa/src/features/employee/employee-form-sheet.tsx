"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { EmployeeForm } from "./employee-form";
import { useCreateEmployee, useUpdateEmployee, useOrgOptions } from "./hooks";
import type { EmployeeDetail, EmployeeFormValues } from "./types";

const FORM_ID = "employee-form";

function dateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : undefined;
}

function toFormValues(e: EmployeeDetail): Partial<EmployeeFormValues> {
  return {
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    firstNameEn: e.firstNameEn ?? undefined,
    lastNameEn: e.lastNameEn ?? undefined,
    nickname: e.nickname ?? undefined,
    email: e.email ?? undefined,
    phone: e.phone ?? undefined,
    gender: e.gender ?? undefined,
    dateOfBirth: dateInput(e.dateOfBirth),
    nationalId: e.nationalId ?? undefined,
    maritalStatus: e.maritalStatus ?? undefined,
    branchId: e.branch?.id,
    departmentId: e.department?.id,
    positionId: e.position?.id,
    managerId: e.manager?.id,
    employmentType: e.employmentType,
    status: e.status,
    hireDate: dateInput(e.hireDate),
    probationEndDate: dateInput(e.probationEndDate),
    terminationDate: dateInput(e.terminationDate),
    baseSalary: e.baseSalary ?? undefined,
    bankName: e.bankName ?? undefined,
    bankAccountNo: e.bankAccountNo ?? undefined,
    addressLine: e.addressLine ?? undefined,
    district: e.district ?? undefined,
    province: e.province ?? undefined,
    postalCode: e.postalCode ?? undefined,
  };
}

export function EmployeeFormSheet({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeDetail | null;
}) {
  const isEdit = !!employee;
  const { data: orgData } = useOrgOptions();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee(employee?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(values: EmployeeFormValues) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("เพิ่มพนักงานเรียบร้อย");
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      toast.error(message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `แก้ไขข้อมูลของ ${employee?.firstName} ${employee?.lastName}`
              : "กรอกข้อมูลเพื่อเพิ่มพนักงานเข้าสู่ระบบ"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* key forces a fresh form instance when switching records */}
          <EmployeeForm
            key={employee?.id ?? "new"}
            formId={FORM_ID}
            defaultValues={employee ? toFormValues(employee) : undefined}
            orgOptions={orgData?.data}
            onSubmit={handleSubmit}
          />
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เพิ่มพนักงาน"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
