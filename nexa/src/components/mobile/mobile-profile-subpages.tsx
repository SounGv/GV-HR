"use client";

import { useSyncExternalStore } from "react";
import { MobileScreen } from "./mobile-screen";
import { SelfProfileForm } from "@/features/profile/self-profile-form";
import { SessionListView } from "@/features/auth-sessions/session-list-view";
import { TwoFactorSettings } from "@/features/auth-mfa/two-factor-settings";

function subscribeHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot() {
  return window.location.hash;
}

function getServerHashSnapshot() {
  return "";
}

/** Renders profile / security sub-screens on mobile when URL hash is set. */
export function MobileProfileSubpages() {
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, getServerHashSnapshot);

  if (hash === "#profile-form") {
    return (
      <MobileScreen title="ตั้งค่าโปรไฟล์" backHref="/profile" contentClassName="space-y-4 p-4">
        <SelfProfileForm />
      </MobileScreen>
    );
  }

  if (hash === "#security") {
    return (
      <MobileScreen title="ความปลอดภัย" backHref="/profile" contentClassName="space-y-4 p-4">
        <TwoFactorSettings />
        <SessionListView />
      </MobileScreen>
    );
  }

  return null;
}
