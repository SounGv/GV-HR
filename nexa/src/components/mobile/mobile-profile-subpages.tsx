"use client";

import { MobileScreen } from "./mobile-screen";
import { SelfProfileForm } from "@/features/profile/self-profile-form";
import { TwoFactorSettings } from "@/features/auth-mfa/two-factor-settings";
import { SessionListView } from "@/features/auth-sessions/session-list-view";

export function MobileProfileFormSubpage({ onBack }: { onBack: () => void }) {
  return (
    <MobileScreen title="ข้อมูลส่วนตัว" onBack={onBack} contentClassName="space-y-4 pb-6">
      <SelfProfileForm />
    </MobileScreen>
  );
}

export function MobileProfileSecuritySubpage({ onBack }: { onBack: () => void }) {
  return (
    <MobileScreen title="ความปลอดภัย" onBack={onBack} contentClassName="space-y-4 pb-6">
      <TwoFactorSettings />
      <SessionListView />
    </MobileScreen>
  );
}
