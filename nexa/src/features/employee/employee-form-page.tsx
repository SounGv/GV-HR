"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeaderBar, type Crumb } from "@/components/shared/page-header-bar";
import { FormFooter, type FormFooterAction } from "@/components/shared/form-footer";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";

import { EmployeeForm } from "./employee-form";
import { toFormValues } from "./form-values";
import { useCreateEmployee, useUpdateEmployee, useOrgOptions } from "./hooks";
import type { EmployeeDetail, EmployeeFormValues } from "./types";

const FORM_ID = "employee-form";
const LIST = "/employees";

type Intent = "save" | "close" | "another";

/** Full-page create/edit screen for an employee. Replaces the old side Sheet. */
export function EmployeeFormPage({
  mode,
  employee,
}: {
  mode: "new" | "edit";
  employee?: EmployeeDetail;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const { data: orgData } = useOrgOptions();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee(employee?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const intentRef = useRef<Intent>("save");
  const [formKey, setFormKey] = useState(0); // bump to reset the form ("create another")

  const detailHref = employee ? `${LIST}/${employee.id}` : LIST;

  async function handleSubmit(values: EmployeeFormValues) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(intentRef.current === "close" ? LIST : detailHref);
      } else {
        const created = await createMutation.mutateAsync(values);
        toast.success("เพิ่มพนักงานเรียบร้อย");
        if (intentRef.current === "another") {
          setFormKey((k) => k + 1);
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (intentRef.current === "close") {
          router.push(LIST);
        } else {
          router.push(`${LIST}/${created.data.id}`);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  const withIntent = (i: Intent) => () => {
    intentRef.current = i;
  };

  const actions: FormFooterAction[] = [
    ...(isEdit ? [] : [{ label: "บันทึกและเพิ่มใหม่", onClick: withIntent("another") }]),
    { label: "บันทึกและปิด", onClick: withIntent("close") },
    { label: isEdit ? "บันทึก" : "เพิ่มพนักงาน", onClick: withIntent("save"), primary: true },
  ];

  const breadcrumbs: Crumb[] = [
    { label: "พนักงาน", href: LIST },
    ...(isEdit && employee
      ? [{ label: `${employee.firstName} ${employee.lastName}`, href: detailHref }]
      : []),
    { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" },
  ];

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={breadcrumbs}
        backHref={isEdit ? detailHref : LIST}
        title={isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}
        description={
          isEdit && employee
            ? `${employee.employeeCode} · ${employee.firstName} ${employee.lastName}`
            : "กรอกข้อมูลเพื่อเพิ่มพนักงานเข้าสู่ระบบ"
        }
      />

      <Card>
        <CardContent className="pt-6">
          <EmployeeForm
            key={`${employee?.id ?? "new"}-${formKey}`}
            formId={FORM_ID}
            defaultValues={employee ? toFormValues(employee) : undefined}
            orgOptions={orgData?.data}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>

      <FormFooter
        formId={FORM_ID}
        pending={pending}
        onCancel={() => router.push(isEdit ? detailHref : LIST)}
        actions={actions}
      />
    </div>
  );
}
