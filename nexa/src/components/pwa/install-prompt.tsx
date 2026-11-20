"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Clock3, Globe, MoreHorizontal, Share, Smartphone, SquarePlus, Zap } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

/**
 * Invites phone visitors to put GV One on the home screen (mock approved 17 Nov 2026). Three cases, because the browsers differ:
 *  - Android Chrome: the browser tells us the app is installable (`beforeinstallprompt`), and the button opens its own install dialog.
 *  - iPhone: a page cannot start the install, so the sheet lists the three taps (share, add to home screen, add).
 *  - Inside LINE, Facebook and similar apps: installing is impossible there, so the sheet says how to open the link in the browser.
 * It shows only on the sign-in and home pages, only on phones, never from an installed icon, and waits after "later" or "never".
 * There is no service worker behind the installed icon (see PwaRegister), so it is a full-screen shortcut, not an offline app.
 */

const STORAGE_KEY = "gv-install-prompt";
const LATER_DAYS = 7;
const SHOW_ON = new Set(["/login", "/dashboard"]);

type Kind = "android" | "android-manual" | "ios" | "inapp";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readState(): "never" | number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { never?: boolean; until?: number };
    if (v.never) return "never";
    return typeof v.until === "number" ? v.until : null;
  } catch {
    return null;
  }
}

function writeState(value: { never: true } | { until: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode: the sheet may come back next visit, which is acceptable */
  }
}

/** Which sheet suits this browser; null when nothing should be offered (desktop, installed, or unknown). */
function detectKind(hasInstallEvent: boolean): Kind | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  if (!isIos && !isAndroid) return null;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  if (/\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)/.test(ua)) return "inapp";
  if (isIos) return "ios";
  return hasInstallEvent ? "android" : "android-manual";
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [kind, setKind] = useState<Kind | null>(null);
  const [open, setOpen] = useState(false);
  const installEvent = useRef<InstallEvent | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [eventReady, setEventReady] = useState(false);

  // The browser fires this once it decides the app can be installed, usually before the page finishes loading.
  useEffect(() => {
    const onReady = (e: Event) => {
      e.preventDefault();
      installEvent.current = e as InstallEvent;
      setEventReady(true);
    };
    const onInstalled = () => {
      writeState({ never: true });
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!SHOW_ON.has(pathname)) {
      setOpen(false);
      return;
    }
    const state = readState();
    if (state === "never" || (typeof state === "number" && state > Date.now())) return;
    let timer: number | undefined;
    const tryOpen = () => {
      const k = detectKind(eventReady);
      if (!k) return;
      // Never cover a field the person is typing into; try again a moment after they leave it.
      const el = document.activeElement;
      // Nor over a full-screen flow such as the check-in camera.
      if (document.querySelector("[data-gv-fullscreen]") || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) {
        timer = window.setTimeout(tryOpen, 1500);
        return;
      }
      setKind(k);
      setOpen(true);
    };
    timer = window.setTimeout(tryOpen, 2500);
    return () => window.clearTimeout(timer);
  }, [pathname, eventReady]);

  const later = useCallback(() => {
    writeState({ until: Date.now() + LATER_DAYS * 86_400_000 });
    setOpen(false);
  }, []);
  const never = useCallback(() => {
    writeState({ never: true });
    setOpen(false);
  }, []);

  async function install() {
    const ev = installEvent.current;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    installEvent.current = null;
    if (outcome === "accepted") never();
    else later();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login`);
      toast.success("คัดลอกลิงก์แล้ว นำไปวางในเบราว์เซอร์ได้เลย");
    } catch {
      toast.error("คัดลอกไม่ได้ ให้แตะ ⋯ แล้วเลือกเปิดในเบราว์เซอร์แทน");
    }
  }

  // While the sheet is open: the page behind does not scroll, Escape means "later", and Tab stays inside the sheet.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        later();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select");
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, later]);

  if (!open || !kind) return null;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[65] bg-black/35 md:hidden" onClick={later} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-install-title"
        className="gv-lg fixed inset-x-2.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-[70] rounded-[30px] px-5 pt-2.5 pb-5 md:hidden"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-[var(--lg-field)]/50" />
        <div className="flex items-center gap-3.5">
          <span className="gv-lg-tile flex size-[60px] shrink-0 items-center justify-center overflow-hidden rounded-2xl">
            <Logo size={44} className="h-auto w-11" />
          </span>
          <div className="min-w-0">
            <h2 id="gv-install-title" className="text-[19px] leading-snug font-bold text-foreground">
              {kind === "inapp" ? "เปิดในเบราว์เซอร์ก่อน" : kind === "ios" ? "เพิ่ม GV One ลงหน้าจอโฮม" : "ติดตั้ง GV One ไว้บนหน้าจอ"}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {kind === "inapp"
                ? "หน้านี้เปิดอยู่ในแอปอื่น จึงติดตั้งจากตรงนี้ไม่ได้"
                : kind === "ios"
                  ? "iPhone ต้องทำเองใน Safari ตามนี้"
                  : window.location.host}
            </p>
          </div>
        </div>

        {kind === "android" && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <Perk icon={Zap} text="เปิดได้ในแตะเดียว" />
            <Perk icon={Smartphone} text="เต็มจอเหมือนแอป" />
            <Perk icon={Clock3} text="ลงเวลาได้เร็วขึ้น" />
          </div>
        )}

        {kind === "ios" && (
          <ol className="mt-3.5 grid gap-2">
            <Step n={1} icon={Share}>
              แตะปุ่ม <b>แชร์</b> ที่แถบด้านล่าง (ถ้าไม่เห็น แตะ <b>⋯</b> ก่อน)
            </Step>
            <Step n={2} icon={SquarePlus}>
              เลือก <b>เพิ่มไปยังหน้าจอโฮม</b>
            </Step>
            <Step n={3} icon={Check}>
              แตะ <b>เพิ่ม</b> มุมขวาบน
            </Step>
          </ol>
        )}

        {kind === "android-manual" && (
          <ol className="mt-3.5 grid gap-2">
            <Step n={1} icon={MoreHorizontal}>
              แตะเมนู <b>⋮</b> มุมขวาบนของเบราว์เซอร์
            </Step>
            <Step n={2} icon={SquarePlus}>
              เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปยังหน้าจอหลัก</b>
            </Step>
            <Step n={3} icon={Check}>
              ยืนยัน แล้วไอคอนจะขึ้นที่หน้าจอ
            </Step>
          </ol>
        )}

        {kind === "inapp" && (
          <ol className="mt-3.5 grid gap-2">
            <Step n={1} icon={MoreHorizontal}>
              แตะ <b>⋯</b> มุมขวาบนของแอปที่เปิดอยู่
            </Step>
            <Step n={2} icon={Globe}>
              เลือก <b>เปิดในเบราว์เซอร์</b>
            </Step>
            <Step n={3} icon={Check}>
              จะเห็นขั้นตอนติดตั้งอีกครั้งในเบราว์เซอร์
            </Step>
          </ol>
        )}

        <div className="mt-3.5 grid gap-1.5">
          {kind === "android" ? (
            <PrimaryButton onClick={install}>ติดตั้ง</PrimaryButton>
          ) : kind === "inapp" ? (
            <PrimaryButton onClick={copyLink}>คัดลอกลิงก์</PrimaryButton>
          ) : (
            <PrimaryButton onClick={later}>เข้าใจแล้ว</PrimaryButton>
          )}
          {kind === "android" || kind === "inapp" ? (
            <TextButton onClick={later}>ไว้ทีหลัง</TextButton>
          ) : (
            <TextButton onClick={never}>ไม่ต้องเตือนอีก</TextButton>
          )}
        </div>
      </div>
    </>
  );
}

function Perk({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-primary">
      <Icon className="size-4" aria-hidden="true" /> {text}
    </span>
  );
}

function Step({ n, icon: Icon, children }: { n: number; icon: typeof Zap; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-[18px] border border-[var(--lg-edge)] bg-[var(--lg-glass-strong)] px-3 py-2.5 text-sm text-foreground">
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
    </li>
  );
}

function PrimaryButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      autoFocus
      className={cn(
        "h-[52px] rounded-full bg-[linear-gradient(180deg,#42a5f5,#1565c0)] text-base font-bold text-white shadow-[0_12px_24px_rgba(21, 101, 192,.36),inset_0_1px_0_rgba(255,255,255,.5)] transition active:scale-[0.99] dark:text-[#06201d] dark:bg-[linear-gradient(180deg,#90caf9,#42a5f5)]",
        className,
      )}
      {...props}
    />
  );
}

function TextButton({ className, ...props }: React.ComponentProps<"button">) {
  return <button type="button" className={cn("min-h-11 rounded-full text-sm font-semibold text-muted-foreground", className)} {...props} />;
}
