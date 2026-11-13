/**
 * Typed application errors. Throw these from services / route handlers; the
 * central handler (`handleApiError`) maps them to consistent HTTP responses.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NO_EMPLOYEE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const BadRequest = (msg = "คำขอไม่ถูกต้อง", details?: unknown) =>
  new AppError("BAD_REQUEST", 400, msg, details);
export const Unauthorized = (msg = "ไม่ได้เข้าสู่ระบบ") =>
  new AppError("UNAUTHORIZED", 401, msg);
export const Forbidden = (msg = "ไม่มีสิทธิ์เข้าถึง") =>
  new AppError("FORBIDDEN", 403, msg);
/** The account is not linked to an employee record, so it has nothing that is "mine". */
export const NoEmployee = (msg = "บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน") =>
  new AppError("NO_EMPLOYEE", 403, msg);
export const NotFound = (msg = "ไม่พบข้อมูล") => new AppError("NOT_FOUND", 404, msg);
export const Conflict = (msg = "ข้อมูลซ้ำ", details?: unknown) =>
  new AppError("CONFLICT", 409, msg, details);
