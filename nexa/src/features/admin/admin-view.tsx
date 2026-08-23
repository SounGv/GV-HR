"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesMatrix } from "./roles-matrix";
import { UsersRoles } from "./users-roles";
import { AuditLogView } from "@/features/audit/audit-log-view";

const TABS = ["roles", "users", "audit"] as const;

export function AdminView() {
  // Nav links deep-link here via ?tab=<roles|users|audit> (e.g.
  // "ประวัติการนำเข้า/ส่งออก" → /admin?tab=audit).
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (TABS as readonly string[]).includes(tabParam ?? "") ? tabParam! : "roles";

  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">บทบาทและสิทธิ์</TabsTrigger>
        <TabsTrigger value="users">ผู้ใช้และบทบาท</TabsTrigger>
        <TabsTrigger value="audit">บันทึกการใช้งาน</TabsTrigger>
      </TabsList>
      <TabsContent value="roles">
        <Suspense>
          <RolesMatrix />
        </Suspense>
      </TabsContent>
      <TabsContent value="users">
        <UsersRoles />
      </TabsContent>
      <TabsContent value="audit">
        <AuditLogView />
      </TabsContent>
    </Tabs>
  );
}
