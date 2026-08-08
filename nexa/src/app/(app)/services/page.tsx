import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

import { MobileHomeView } from "@/components/mobile/mobile-home-view";

import { ServicesGridView } from "@/features/services/services-grid-view";



export const metadata: Metadata = { title: "บริการ" };



export default async function ServicesPage({

  searchParams,

}: {

  searchParams: Promise<{ view?: string }>;

}) {

  const user = await getCurrentUser();

  if (!user) redirect("/login");



  const { view } = await searchParams;

  const isMenuSettings = view === "menu-settings";



  return (

    <>

      {!isMenuSettings && <MobileHomeView title="บริการ" />}

      <div className="hidden md:block">

        <ServicesGridView />

      </div>

    </>

  );

}


