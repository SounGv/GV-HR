"use client";

import { useSyncExternalStore } from "react";
import { MobileScreen } from "./mobile-screen";
import { SelfProfileForm } from "@/features/profile/self-profile-form";
import { SessionListView } from "@/features/auth-sessions/session-list-view";
import { TwoFactorSettings } from "@/features/auth-mfa/two-factor-settings";
import { ChangePasswordForm } from "@/features/auth-password/change-password-form";

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

  // Back needs to actually clear the hash — a Next.js <Link> (even to the
  // same path minus the hash) navigates via history.pushState, which does
  // NOT fire the native `hashchange` event this view depends on, so the
  // subpage would stay stuck on screen. history.back() pops the entry the
  // hash-set itself pushed, which does fire hashchange like normal browser
  // back navigation.
  const goBack = () => window.history.back();

  if (hash === "#profile-form") {
    return (
      <MobileScreen title="ตั้งค่าโปรไฟล์" onBack={goBack} contentClassName="space-y-4 p-4">
        <SelfProfileForm />
      </MobileScreen>
    );
  }

  if (hash === "#security") {
    return (
      <MobileScreen title="ความปลอดภัย" onBack={goBack} contentClassName="space-y-4 p-4">
        <ChangePasswordForm />
        <TwoFactorSettings />
        <SessionListView />
      </MobileScreen>
    );
  }

  return null;
}
