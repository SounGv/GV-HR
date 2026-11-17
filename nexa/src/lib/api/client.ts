/**
 * Client-side API helper.
 *
 * • Sends cookies (credentials: "include").
 * • On 401, transparently calls /api/auth/refresh ONCE and retries the request.
 *   Concurrent 401s share a single in-flight refresh.
 * • Throws ApiError (with server code + message) on failure so React Query and
 *   UI can render friendly errors.
 */

import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth/constants";

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

/** Reads the (non-httpOnly) CSRF cookie so it can be echoed back as a header. */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** "ok": a new session. "invalid": the server says the session is over (401). "unavailable": the server or the network could not answer; the session is still there. */
type RefreshOutcome = "ok" | "invalid" | "unavailable";

let refreshPromise: Promise<RefreshOutcome> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function refreshOnce(): Promise<RefreshOutcome> {
  try {
    const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (r.ok) return "ok";
    return r.status === 401 ? "invalid" : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function doRefresh(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // A database that is busy for a second or a phone that lost signal for a moment must not end the session: try again a couple of times.
      let outcome = await refreshOnce();
      for (const wait of [500, 1500]) {
        if (outcome !== "unavailable") break;
        await sleep(wait);
        outcome = await refreshOnce();
      }
      return outcome;
    })().finally(() => {
      // Allow a fresh refresh attempt after this one settles.
      setTimeout(() => (refreshPromise = null), 0);
    });
  }
  return refreshPromise;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const body: ApiErrorShape = json?.error ?? {
      code: "INTERNAL",
      message: "เกิดข้อผิดพลาด",
    };
    throw new ApiError(res.status, body);
  }
  return json as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const csrfToken = getCsrfToken();
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { [CSRF_HEADER]: csrfToken } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const refreshed = await doRefresh();
    if (refreshed === "ok") return request<T>(path, options, false);
    // Only a session the server has ended sends the person to sign in. If the refresh just could not be answered,
    // the cookies are still good: this request fails with its own 401 and the next one tries again.
    if (refreshed === "invalid" && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return parse<T>(res);
}

/** Envelope helpers — unwrap `{ data }` / `{ data, meta }`. */
export interface Envelope<T> {
  data: T;
}
export interface PaginatedEnvelope<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
