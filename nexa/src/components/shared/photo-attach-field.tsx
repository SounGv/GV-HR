"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Reads an image file, downscales it, and returns a compact data URL. */
function fileToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์รูปไม่ถูกต้อง"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ไม่รองรับการประมวลผลรูป"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Controlled photo-attach control: picks/captures an image, downsizes it in
 * the browser, and hands back a data URL — the same pattern used for
 * avatars, attendance selfies, and company branding images. `value` may
 * also be a plain https URL (e.g. an existing externally-hosted link);
 * either renders fine in an `<img>`.
 */
export function PhotoAttachField({
  value,
  onChange,
  maxSize = 1280,
  maxBytes = 3_000_000,
  label = "ถ่ายรูป / แนบรูป",
  disabled,
  className,
}: {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  maxSize?: number;
  maxBytes?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file, maxSize);
      if (dataUrl.length > maxBytes) {
        toast.error("ไฟล์ใหญ่เกินไป กรุณาใช้รูปที่เล็กลงหรือถ่ายใหม่");
        return;
      }
      onChange(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "แนบรูปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 p-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="ตัวอย่างรูป" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่มีรูป</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
          {value ? "เปลี่ยนรูป" : label}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("")}>
            <X className="size-3.5" /> ลบ
          </Button>
        )}
      </div>
    </div>
  );
}
