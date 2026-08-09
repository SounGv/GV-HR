"use client";

import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Controlled generic-file-attach control (résumés, documents) — unlike
 * `PhotoAttachField`, the file isn't necessarily an image so it's stored
 * as-is (no canvas resize). `value` may be a data URL or a plain https URL.
 */
export function FileAttachField({
  value,
  onChange,
  accept = "application/pdf,image/*,.doc,.docx",
  maxBytes = 3_000_000,
  label = "แนบไฟล์",
  disabled,
  className,
}: {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  accept?: string;
  maxBytes?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl.length > maxBytes) {
        toast.error("ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่เล็กลง");
        return;
      }
      setFileName(file.name);
      onChange(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "แนบไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {value ? "เปลี่ยนไฟล์" : label}
      </Button>
      {value && (
        <>
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
            <FileText className="size-3.5 shrink-0" /> {fileName ?? "ไฟล์ที่แนบไว้"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setFileName(null);
            }}
          >
            <X className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
