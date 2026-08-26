"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api/client";
import { fullName, loginIdentifier } from "@/lib/format";
import { useRoles, useSetUserRoles } from "./hooks";
import type { AdminUser } from "./types";

const FORM_ID = "user-roles-form";
const LIST_HREF = "/admin";

export function UserRolesFormPage({ user }: { user: AdminUser }) {
  const router = useRouter();
  const { data: rolesData } = useRoles();
  const roles = rolesData?.data ?? [];
  const setMut = useSetUserRoles();
  const [selected, setSelected] = useState<Set<string>>(new Set(user.roleIds));

  async function onSubmit() {
    try {
      await setMut.mutateAsync({ id: user.id, roleIds: [...selected] });
      toast.success("อัปเดตบทบาทเรียบร้อย");
      router.push(LIST_HREF);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "บันทึก", primary: true }];
  const name = user.employee ? fullName(user.employee.firstName, user.employee.lastName) : loginIdentifier(user);

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ผู้ดูแลระบบ", href: LIST_HREF }, { label: `บทบาทของ ${name}` }]}
      backHref={LIST_HREF}
      title="แก้ไขบทบาทผู้ใช้"
      description={name}
      formId={FORM_ID}
      pending={setMut.isPending}
      onCancel={() => router.push(LIST_HREF)}
      actions={actions}
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="max-w-md space-y-2"
      >
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
            <Checkbox
              checked={selected.has(r.id)}
              onCheckedChange={(c) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (c === true) next.add(r.id);
                  else next.delete(r.id);
                  return next;
                })
              }
            />
            <span className="flex-1">
              <span className="font-medium">{r.name}</span>
              {r.description && <span className="ml-1 text-xs text-muted-foreground">· {r.description}</span>}
            </span>
          </label>
        ))}
      </form>
    </FormPageShell>
  );
}
