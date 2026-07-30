/**
 * Client-side API helper.
 *
 * • Sends cookies (credentials: "include").
 * • On 401, transparently calls /api/auth/refresh ONCE and retries the request.
 *   Concurrent 401s share a single in-flight refresh.
 * • Throws ApiError (with server code + message) on failure so React Query and
 *   UI can render friendly errors.
 */

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

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
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
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const refreshed = await doRefresh();
    if (refreshed) return request<T>(path, options, false);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
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
