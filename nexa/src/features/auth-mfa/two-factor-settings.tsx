"use client";

import { useState } from "react";
import { Check, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useConfirmMfa, useDisableMfa, useMfaStatus, useSetupMfa } from "./hooks";
import type { MfaSetupResponse } from "./types";

type Step = "idle" | "enrolling" | "recovery" | "disabling";

export function TwoFactorSettings() {
  const { data, isLoading } = useMfaStatus();
  const setupMut = useSetupMfa();
  const confirmMut = useConfirmMfa();
  const disableMut = useDisableMfa();

  const [step, setStep] = useState<Step>("idle");
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");

  const enabled = data?.data.enabled ?? false;

  async function startEnroll() {
    try {
      const res = await setupMut.mutateAsync();
      setSetup(res.data);
      setCode("");
      setStep("enrolling");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เริ่มตั้งค่าไม่สำเร็จ");
    }
  }

  async function confirmEnroll() {
    try {
      const res = await confirmMut.mutateAsync(code);
      setRecoveryCodes(res.data.recoveryCodes);
      setStep("recovery");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รหัสไม่ถูกต้อง");
    }
  }

  function finishRecovery() {
    setStep("idle");
    setSetup(null);
    setCode("");
    setRecoveryCodes([]);
    toast.success("เปิดใช้งาน 2FA เรียบร้อย");
  }

  async function confirmDisable() {
    try {
      await disableMut.mutateAsync(disableCode);
      toast.success("ปิดใช้งาน 2FA เรียบร้อย");
      setStep("idle");
      setDisableCode("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รหัสไม่ถูกต้อง");
    }
  }

  function copyRecoveryCodes() {
    navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(
      () => toast.success("คัดลอกแล้ว"),
      () => {},
    );
  }

  if (isLoading) return null;

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">ยืนยันตัวตนสองขั้นตอน (2FA)</p>
          <p className="text-xs text-muted-foreground">
            เพิ่มความปลอดภัยด้วยรหัสจากแอปยืนยันตัวตน เช่น Google Authenticator
          </p>
        </div>
        {enabled && step === "idle" && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <ShieldCheck className="size-3.5" /> เปิดใช้งานอยู่
          </span>
        )}
      </div>

      {step === "idle" && (
        <div>
          {enabled ? (
            <Button variant="outline" size="sm" onClick={() => setStep("disabling")}>
              <ShieldOff className="size-4" /> ปิดใช้งาน 2FA
            </Button>
          ) : (
            <Button size="sm" onClick={startEnroll} disabled={setupMut.isPending}>
              <ShieldCheck className="size-4" /> เปิดใช้งาน 2FA
            </Button>
          )}
        </div>
      )}

      {step === "enrolling" && setup && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            สแกน QR นี้ด้วยแอปยืนยันตัวตน แล้วกรอกรหัส 6 หลักที่ได้เพื่อยืนยัน
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="QR ตั้งค่า 2FA" width={180} height={180} className="rounded-lg" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">หรือกรอกรหัสลับด้วยตนเอง:</p>
              <p className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs">{setup.secret}</p>
            </div>
          </div>
          <div className="flex max-w-xs items-center gap-2">
            <Input
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center tracking-widest"
            />
            <Button size="sm" onClick={confirmEnroll} disabled={confirmMut.isPending || !code}>
              ยืนยัน
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="text-xs text-muted-foreground hover:underline"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {step === "recovery" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">รหัสสำรอง — บันทึกไว้ในที่ปลอดภัย</p>
          <p className="text-xs text-muted-foreground">
            ใช้แทนรหัส 2FA ได้หากทำอุปกรณ์ยืนยันตัวตนหาย — แต่ละรหัสใช้ได้ครั้งเดียว และจะแสดงเพียงครั้งนี้เท่านั้น
          </p>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-3 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyRecoveryCodes}>
              <Copy className="size-4" /> คัดลอกทั้งหมด
            </Button>
            <Button size="sm" onClick={finishRecovery}>
              <Check className="size-4" /> ฉันบันทึกรหัสสำรองแล้ว
            </Button>
          </div>
        </div>
      )}

      {step === "disabling" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">กรอกรหัส 2FA หรือรหัสสำรองเพื่อยืนยันการปิดใช้งาน</p>
          <div className="flex max-w-xs items-center gap-2">
            <Input
              placeholder="รหัสยืนยัน"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDisable}
              disabled={disableMut.isPending || !disableCode}
            >
              ยืนยันปิดใช้งาน
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setDisableCode("");
            }}
            className="text-xs text-muted-foreground hover:underline"
          >
            ยกเลิก
          </button>
        </div>
      )}
    </Card>
  );
}
