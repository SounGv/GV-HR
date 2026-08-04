"use client";

import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesMatrix } from "./roles-matrix";
import { UsersRoles } from "./users-roles";
import { AuditLogView } from "@/features/audit/audit-log-view";

export function AdminView() {
  return (
    <Tabs defaultValue="roles" className="space-y-4">
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
