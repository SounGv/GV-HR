"use client";

import { useState } from "react";

/** What the enlarged-photo dialog shows next to the picture. */
export interface PhotoPreview {
  url: string;
  title?: string;
  lines?: string[];
}

/** Small clickable thumbnail for a photo-flagged report column — "-" (no
 * photo attached) renders as plain text, same as every other empty cell.
 * Shared by the desktop table and the mobile card list. 44px so it is a
 * proper touch target; `loading="lazy"` keeps off-screen thumbnails from being
 * decoded until they are scrolled near. */
export function PhotoCell({
  url,
  onOpen,
  title,
  lines,
}: {
  url: string | number;
  onOpen: (photo: PhotoPreview) => void;
  title?: string;
  lines?: string[];
}) {
  const [failed, setFailed] = useState(false);
  if (typeof url !== "string" || !url || url === "-") return <span className="text-muted-foreground">-</span>;
  if (failed) return <span className="text-xs text-muted-foreground">โหลดรูปไม่ได้</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen({ url, title, lines })}
      aria-label={title ? `ดู${title}ขนาดใหญ่` : "ดูรูปถ่ายขนาดใหญ่"}
      className="block size-11 overflow-hidden rounded-md border border-border transition hover:opacity-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </button>
  );
}
