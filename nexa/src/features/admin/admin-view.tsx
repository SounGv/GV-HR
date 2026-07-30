"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesMatrix } from "./roles-matrix";
import { UsersRoles } from "./users-roles";

export function AdminView() {
  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">บทบาทและสิทธิ์</TabsTrigger>
        <TabsTrigger value="users">ผู้ใช้และบทบาท</TabsTrigger>
      </TabsList>
      <TabsContent value="roles">
        <RolesMatrix />
      </TabsContent>
      <TabsContent value="users">
        <UsersRoles />
      </TabsContent>
    </Tabs>
  );
}
