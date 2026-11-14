"use client";

import { useCallback, useRef, useState } from "react";
import { Download, FileText, Paperclip, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, ATTACH_HINT, checkFiles, sizeText } from "./attachments";
import type { AttachmentPayload, OutFile } from "./types";

export interface PickedFile {
  id: string;
  file: File;
}

/** Reads a File as base64 (without the `data:` prefix). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The files picked for the next message. New files are checked together with the ones already picked (count,
 * kind, total size); if the set would not be allowed, none of the new files are added and every problem is
 * listed so they can all be fixed at once. Nothing is uploaded until the message is sent.
 */
export function useAttachments() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const counter = useRef(0);

  const add = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (incoming.length === 0) return;
      const next = [...files.map((f) => f.file), ...incoming];
      const check = checkFiles(next.map((f) => ({ name: f.name, size: f.size })));
      if (!check.ok) {
        setErrors(check.problems);
        return;
      }
      setErrors([]);
      setFiles((prev) => [...prev, ...incoming.map((file) => ({ id: `f${++counter.current}`, file }))]);
    },
    [files],
  );
  const remove = useCallback((id: string) => {
    setErrors([]);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);
  const clear = useCallback(() => {
    setErrors([]);
    setFiles([]);
  }, []);
  const toPayload = useCallback(async (): Promise<AttachmentPayload[]> => {
    const out: AttachmentPayload[] = [];
    for (const f of files) out.push({ name: f.file.name, data: await readBase64(f.file) });
    return out;
  }, [files]);

  return { files, errors, add, remove, clear, toPayload };
}

/** The paperclip: opens the file picker. 44px so it is easy to hit on a phone. */
export function AttachButton({ onPick, disabled, className }: { onPick: (files: FileList) => void; disabled?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label="แนบไฟล์"
        title={ATTACH_HINT}
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <Paperclip className="size-5" aria-hidden="true" />
      </button>
    </>
  );
}

function Chip({ name, size, onRemove, className }: { name: string; size: number; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-[10px] border px-2.5 py-0.5 text-[13px] leading-snug", className)}>
      <FileText className="size-[15px] shrink-0" aria-hidden="true" />
      <span className="break-all">{name}</span>
      <span className="text-xs whitespace-nowrap opacity-75">{sizeText(size)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`เอา ${name} ออก`}
          className="-mr-2 -my-1 flex size-8 shrink-0 items-center justify-center rounded-lg opacity-75 hover:bg-muted hover:opacity-100"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Picked files above the message box, with the problems (if any) and the one-line note that they are not stored. */
export function AttachTray({ files, errors, onRemove, hint = true }: { files: PickedFile[]; errors: string[]; onRemove: (id: string) => void; hint?: boolean }) {
  if (files.length === 0 && errors.length === 0) return null;
  return (
    <div className="space-y-1.5 pb-2">
      {errors.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-status-absent-border bg-status-absent-bg px-3 py-2 text-[13.5px] text-status-absent-fg">
          <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>{errors.join(" ")}</span>
        </p>
      )}
      {files.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <Chip key={f.id} name={f.file.name} size={f.file.size} onRemove={() => onRemove(f.id)} className="border-border bg-card text-foreground" />
            ))}
          </div>
          {hint && <p className="text-xs text-muted-foreground">ไฟล์ใช้กับข้อความนี้เท่านั้น ระบบไม่เก็บไฟล์ไว้ ถ้าถามต่อและต้องการให้ดูไฟล์อีก ให้แนบใหม่</p>}
        </>
      )}
    </div>
  );
}

/** Files shown on a message that was sent with attachments (no remove button). */
export function SentFiles({ files, tone = "onTeal" }: { files: { name: string; size: number }[] | undefined; tone?: "onTeal" | "plain" }) {
  if (!files || files.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <Chip key={i} name={f.name} size={f.size} className={tone === "onTeal" ? "border-white/45 bg-white/15 text-white" : "border-border bg-card text-foreground"} />
      ))}
    </span>
  );
}

/** Saves a file the assistant made. The browser gets the bytes from the reply; nothing is fetched. */
function download(file: OutFile) {
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download buttons for the files น้องวีบอท made for this answer. */
export function FileDownloads({ files }: { files: OutFile[] | undefined }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <button
          key={`${f.name}-${i}`}
          type="button"
          onClick={() => download(f)}
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition hover:border-primary"
        >
          <Download className="size-[18px] shrink-0 text-status-normal-fg" aria-hidden="true" />
          <span className="break-all">{f.name}</span>
          <span className="text-xs font-normal whitespace-nowrap text-muted-foreground">{sizeText(Math.round((f.data.length * 3) / 4))}</span>
        </button>
      ))}
    </div>
  );
}
