import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, type ErrorCode } from "./errors";

/**
 * Standard success/error envelope so every endpoint responds consistently:
 *   success → { data, meta? }
 *   error   → { error: { code, message, details? } }
 */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ data }, responseInit);
}

export function okPaginated<T>(data: T[], meta: PageMeta) {
  return NextResponse.json({ data, meta });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/**
 * Central error mapper. Wrap route-handler bodies in try/catch and pass the
 * caught value here — it normalizes AppError, ZodError, and Prisma known errors
 * into the standard envelope, and never leaks internals for unexpected errors.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(errorBody(err.code, err.message, err.details), {
      status: err.status,
    });
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      errorBody("VALIDATION", "ข้อมูลไม่ถูกต้อง", err.flatten()),
      { status: 422 },
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint, P2025 = record not found
    if (err.code === "P2002") {
      return NextResponse.json(
        errorBody("CONFLICT", "ข้อมูลนี้มีอยู่ในระบบแล้ว", { target: err.meta?.target }),
        { status: 409 },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(errorBody("NOT_FOUND", "ไม่พบข้อมูล"), { status: 404 });
    }
  }

  // Unknown / unexpected — log server-side, return opaque 500.
  console.error("[api] unhandled error:", err);
  // TEMP DEBUG: surface the real error to diagnose the Vercel-only 500. Revert after.
  const debugDetail =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return NextResponse.json(
    errorBody("INTERNAL", "เกิดข้อผิดพลาดภายในระบบ", { debug: debugDetail }),
    { status: 500 },
  );
}
