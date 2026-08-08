"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileProfileView } from "./mobile-profile-view";
import { MobileProfileFormSubpage, MobileProfileSecuritySubpage } from "./mobile-profile-subpages";

type ProfileSubpage = "list" | "profile-form" | "security";

function readHashSubpage(): ProfileSubpage {
  if (typeof window === "undefined") return "list";
  const hash = window.location.hash.replace("#", "");
  if (hash === "profile-form" || hash === "security") return hash;
  return "list";
}

export function MobileProfilePage() {
  const [subpage, setSubpage] = useState<ProfileSubpage>("list");

  const syncFromHash = useCallback(() => {
    setSubpage(readHashSubpage());
  }, []);

  useEffect(() => {
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [syncFromHash]);

  function openSubpage(next: Exclude<ProfileSubpage, "list">) {
    window.location.hash = next;
    setSubpage(next);
  }

  function backToList() {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setSubpage("list");
  }

  if (subpage === "profile-form") {
    return <MobileProfileFormSubpage onBack={backToList} />;
  }

  if (subpage === "security") {
    return <MobileProfileSecuritySubpage onBack={backToList} />;
  }

  return (
    <MobileProfileView
      onOpenForm={() => openSubpage("profile-form")}
      onOpenSecurity={() => openSubpage("security")}
    />
  );
}
