import { randomBytes, createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";

/**
 * TOTP (RFC 6238) enrollment + verification, plus single-use recovery codes
 * for the "lost my authenticator device" case. No SMS/email OTP here — this
 * codebase has no SMS gateway, and TOTP (Google/Microsoft Authenticator style)
 * needs no external service at all.
 */

const ISSUER = "NEXA";

export function generateSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(secret: string, email: string): TOTP {
  return new TOTP({ issuer: ISSUER, label: email, secret });
}

export function buildOtpAuthUrl(secret: string, email: string): string {
  return totpFor(secret, email).toString();
}

/** ±1 time-step (30s) window tolerates minor clock drift between device and server. */
export function verifyTotp(secret: string, email: string, code: string): boolean {
  const delta = totpFor(secret, email).validate({ token: code.trim(), window: 1 });
  return delta !== null;
}

function randomRecoveryCode(): string {
  // 10 uppercase base32-ish chars (no 0/O/1/I ambiguity), grouped for readability.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const byte of randomBytes(10)) {
    out += alphabet[byte % alphabet.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, randomRecoveryCode);
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}
