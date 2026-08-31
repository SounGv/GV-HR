"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { loginSchema, type LoginInput as LoginInputData } from "./schema";
import { api, ApiError, type Envelope } from "@/lib/api/client";
import { MFA_PENDING_COOKIE } from "@/lib/auth/constants";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoginInput } from "./login-input";
import { PasswordInput } from "./password-input";
import { LoginButton } from "./login-button";

const OAUTH_ERROR_MESSAGE: Record<string, string> = {
  google_disabled: "ยังไม่ได้เปิดใช้งานเข้าสู่ระบบด้วย Google",
  google_invalid_state: "เซสชันเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่",
};

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const form = useForm<LoginInputData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && OAUTH_ERROR_MESSAGE[error]) {
      toast.error(OAUTH_ERROR_MESSAGE[error]);
    }

    if (searchParams.get("mfa") === "google") {
      const token = readCookie(MFA_PENDING_COOKIE);
      clearCookie(MFA_PENDING_COOKIE);
      if (token) {
        setMfaToken(token);
      } else {
        toast.error("เซสชันยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToRedirect() {
    const redirect = searchParams.get("redirect") || "/dashboard";
    router.replace(redirect);
    router.refresh();
  }

  async function onSubmit(values: LoginInputData) {
    setSubmitting(true);
    try {
      const res = await api.post<Envelope<{ mfaRequired?: boolean; mfaToken?: string }>>(
        "/api/auth/login",
        values,
      );
      if (res.data.mfaRequired && res.data.mfaToken) {
        setMfaToken(res.data.mfaToken);
        setSubmitting(false);
        return;
      }
      goToRedirect();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function onSubmitMfa() {
    if (!mfaToken) return;
    setSubmitting(true);
    try {
      await api.post("/api/auth/mfa/verify", { mfaToken, code: mfaCode });
      goToRedirect();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่";
      toast.error(message);
      setSubmitting(false);
    }
  }

  if (mfaToken) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitMfa();
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--login-text-primary)]">
          <ShieldCheck className="size-4 text-[var(--login-brand-green)]" /> ยืนยันตัวตนสองขั้นตอน
        </div>
        <p className="text-xs text-[var(--login-text-secondary)]">
          กรอกรหัส 6 หลักจากแอปยืนยันตัวตน หรือรหัสสำรองของคุณ
        </p>
        <Input
          autoFocus
          inputMode="numeric"
          placeholder="123456"
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          className="h-[52px] rounded-[11px] border-[var(--login-border)] !bg-[var(--login-surface)] text-center text-lg tracking-widest !text-[var(--login-text-primary)] focus-visible:border-[var(--login-brand-green)] focus-visible:ring-[var(--login-brand-green)]/15"
        />
        <LoginButton type="submit" loading={submitting} disabled={!mfaCode}>
          ยืนยัน
        </LoginButton>
        <button
          type="button"
          onClick={() => {
            setMfaToken(null);
            setMfaCode("");
          }}
          className="w-full text-center text-xs text-[var(--login-text-secondary)] hover:underline"
        >
          กลับไปเข้าสู่ระบบใหม่
        </button>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-[var(--login-text-primary)]">อีเมล</FormLabel>
              <FormControl>
                <LoginInput
                  icon={<Mail className="size-4" />}
                  type="text"
                  autoComplete="username"
                  placeholder="กรอกอีเมลของคุณ"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="font-semibold text-[var(--login-text-primary)]">รหัสผ่าน</FormLabel>
                <Link href="/forgot-password" className="text-xs font-medium text-[var(--login-brand-green)] hover:underline">
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" placeholder="กรอกรหัสผ่านของคุณ" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LoginButton type="submit" loading={submitting}>
          เข้าสู่ระบบ
        </LoginButton>

        {googleEnabled && (
          <>
            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-[var(--login-border)]" />
              <span className="px-3 text-xs text-[var(--login-text-secondary)]">หรือ</span>
              <div className="flex-1 border-t border-[var(--login-border)]" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-[52px] w-full rounded-[11px] border-[var(--login-border)] !bg-[var(--login-surface)] !text-[var(--login-text-primary)]"
              render={<a href="/api/auth/google" />}
            >
              <GoogleIcon className="size-4" /> เข้าสู่ระบบด้วย Google
            </Button>
          </>
        )}
      </form>
    </Form>
  );
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.89c2.28-2.1 3.56-5.19 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.25v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.3v-3.1H1.25A12 12 0 0 0 0 12c0 1.94.46 3.77 1.25 5.4l4.03-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.25 6.6l4.03 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}
