"use client";



import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";



export function MobileHeader({

  title,

  backHref,

  onBack,

  trailing,

  className,

}: {

  title: React.ReactNode;

  backHref?: string;

  onBack?: () => void;

  trailing?: React.ReactNode;

  className?: string;

}) {

  const showBack = !!backHref || !!onBack;



  return (

    <header

      className={cn(

        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2.5 bg-primary px-3 md:hidden",

        className,

      )}

    >

      {showBack &&

        (backHref ? (

          <Link

            href={backHref}

            aria-label="ย้อนกลับ"

            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-primary-foreground transition active:scale-95"

          >

            <ArrowLeft className="size-[18px]" />

          </Link>

        ) : (

          <button

            type="button"

            aria-label="ย้อนกลับ"

            onClick={onBack}

            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-primary-foreground transition active:scale-95"

          >

            <ArrowLeft className="size-[18px]" />

          </button>

        ))}

      <h1 className="min-w-0 flex-1 truncate text-base font-bold text-primary-foreground">{title}</h1>

      {trailing && <div className="shrink-0 text-primary-foreground">{trailing}</div>}

    </header>

  );

}


