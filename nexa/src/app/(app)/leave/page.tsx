import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/page-guard";

import { MobileLeaveListView } from "@/components/mobile/mobile-leave-list-view";

import { PageHeader } from "@/components/shared/page-header";

import { LeaveView } from "@/features/leave/leave-view";



export const metadata: Metadata = { title: "การลา" };



export default async function LeavePage({

  searchParams,

}: {

  searchParams: Promise<{ view?: string }>;

}) {

  await requirePagePermission("leave:read");

  const { view } = await searchParams;

  const isOverview = view === "overview";



  return (

    <>

      {!isOverview && <MobileLeaveListView />}

      <div className={isOverview ? "space-y-6 p-4 md:p-0" : "hidden space-y-6 md:block"}>

        <PageHeader title="การลาและ OT" description="ยื่นคำขอลา ดูโควตาวันลา และอนุมัติคำขอของทีม" />

        <LeaveView defaultTab={isOverview ? "approvals" : "me"} />

      </div>

    </>

  );

}


