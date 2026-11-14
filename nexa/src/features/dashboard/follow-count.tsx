"use client";

import { useEffect, useState } from "react";

/**
 * "วันนี้มี N เรื่องที่ควรดู" for the greeting. The cards on the board stream in
 * one by one (each loads on its own), so this counts them in the page as they
 * arrive instead of waiting for every query on the server.
 */
export function FollowCount() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const board = document.getElementById("follow-up");
    if (!board) return;
    const count = () => setN(board.querySelectorAll("[data-follow-card]").length);
    count();
    const obs = new MutationObserver(count);
    obs.observe(board, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  if (n === null) return null;
  if (n === 0) return <p className="text-[15px] font-semibold text-[#15803d] dark:text-[#7ee2a3]">✓ วันนี้ไม่มีเรื่องที่ต้องตาม</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-semibold">
      <span>
        วันนี้มี <span className="text-[#0f766e] dark:text-[#5eead4]">{n} เรื่อง</span>ที่ควรดู
      </span>
      <a
        href="#follow-up"
        className="inline-flex min-h-10 items-center rounded-full bg-[linear-gradient(135deg,#0f766e,#0b4f4a)] px-4 text-[13.5px] text-white shadow-[0_6px_16px_rgba(13,148,136,.22)] hover:brightness-110"
      >
        ดู {n} เรื่องด้านล่าง ↓
      </a>
    </p>
  );
}
