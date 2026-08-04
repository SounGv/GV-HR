import { z } from "zod";
import { listQuerySchema } from "@/lib/api/pagination";
import { passwordSchema } from "@/lib/auth/password-policy";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const MARITAL = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERN",
  "PROBATION",
] as const;
export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
  "RESIGNED",
] as const;

/** Empty string / null → undefined, then run inner schema. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), inner.optional());

const optionalDate = optional(z.coerce.date());
const optionalCuidLike = optional(z.string().uuid());

export const employeeCreateSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณากรอกรหัสพนักงาน").max(20),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(120),
  firstNameEn: optional(z.string().trim().max(120)),
  lastNameEn: optional(z.string().trim().max(120)),
  nickname: optional(z.string().trim().max(60)),
  email: optional(z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง")),
  phone: optional(z.string().trim().max(30)),

  gender: optional(z.enum(GENDERS)),
  dateOfBirth: optionalDate,
  nationalId: optional(z.string().trim().max(20)),
  maritalStatus: optional(z.enum(MARITAL)),

  branchId: optionalCuidLike,
  departmentId: optionalCuidLike,
  positionId: optionalCuidLike,
  managerId: optionalCuidLike,

  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
  hireDate: optionalDate,
  probationEndDate: optionalDate,
  terminationDate: optionalDate,

  baseSalary: optional(z.coerce.number().min(0, "ต้องไม่ติดลบ")),
  bankName: optional(z.string().trim().max(120)),
  bankAccountNo: optional(z.string().trim().max(40)),

  addressLine: optional(z.string().trim().max(255)),
  district: optional(z.string().trim().max(120)),
  province: optional(z.string().trim().max(120)),
  postalCode: optional(z.string().trim().max(10)),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

/** All fields optional for PATCH (partial update). */
export const employeeUpdateSchema = employeeCreateSchema.partial();
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

/** List query = base pagination + employee-specific filters. */
export const employeeListQuerySchema = listQuerySchema.extend({
  departmentId: optional(z.string().uuid()),
  status: optional(z.enum(EMPLOYEE_STATUSES)),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

export const EMPLOYEE_SORTABLE = [
  "employeeCode",
  "firstName",
  "hireDate",
  "createdAt",
  "status",
] as const;

/** HR creates a login account for an employee. */
export const employeeAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  password: passwordSchema,
});
export type EmployeeAccountInput = z.infer<typeof employeeAccountSchema>;

/** HR resets the password of an employee who already has a login account. */
export const employeePasswordResetSchema = z.object({
  password: passwordSchema,
});
export type EmployeePasswordResetInput = z.infer<typeof employeePasswordResetSchema>;
