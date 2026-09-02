"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

function guessMime(url: string): string {
  return /^data:([^;]+);/.exec(url)?.[1] ?? "";
}

function guessExtension(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return mime.split("/")[1] || "jpg";
  if (mime.includes("word")) return "docx";
  return "";
}

/**
 * Drop-in replacement for `<a href={url} target="_blank">` when `url` may be
 * a data: URL — attachments (leave/expense/loan/recruitment/campaign/employee
 * documents) are stored as data URLs via FileAttachField/PhotoAttachField,
 * not uploaded to real hosted files. Mobile browsers (notably iOS Safari)
 * commonly block navigating to a data: URL opened via target="_blank", so a
 * plain link silently does nothing there.
 *
 * Images open in an inline lightbox instead of navigating; other file types
 * download via the `download` attribute, which mobile browsers handle as a
 * save/share action rather than blocked navigation. A real (non-data:) URL
 * still just opens normally in a new tab, unchanged.
 */
export function AttachmentLink({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!isDataUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  const mime = guessMime(url);
  if (mime.startsWith("image/")) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("block border-0 bg-transparent p-0 text-left", className)}
        >
          {children}
        </button>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        )}
      </>
    );
  }

  const ext = guessExtension(mime);
  return (
    <a href={url} download={ext ? `attachment.${ext}` : "attachment"} className={className}>
      {children}
    </a>
  );
}
