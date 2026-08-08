"use client";

import { useSyncExternalStore } from "react";
import { MobileProfileSubpages } from "./mobile-profile-subpages";
import { MobileProfileView } from "./mobile-profile-view";

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

/** Mobile profile hub — list view or hash-driven sub-screens. */
export function MobileProfilePage() {
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, getServerHashSnapshot);
  const subpage = hash === "#profile-form" || hash === "#security";

  return (
    <>
      {!subpage && <MobileProfileView />}
      <MobileProfileSubpages />
    </>
  );
}
