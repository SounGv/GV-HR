export type EmployeeStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "RESIGNED";
export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "INTERN"
  | "PROBATION"
  | "TEMPORARY"
  | "DAILY_WORKER";
export type CompensationType = "MONTHLY" | "DAILY" | "HOURLY";

interface Ref {
  id: string;
  name: string;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  hireDate: string | null;
  department: Ref | null;
  position: { id: string; title: string } | null;
  branch: Ref | null;
}

export interface EmployeeDetail extends EmployeeListItem {
  firstNameEn: string | null;
  lastNameEn: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth: string | null;
  maritalStatus: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | null;
  nationalId: string | null;
  probationEndDate: string | null;
  terminationDate: string | null;
  compensationType: CompensationType;
  baseSalary: string | null; // Prisma Decimal serializes to string
  dailyRate: string | null;
  hourlyRate: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  taxSpouseNoIncome: boolean;
  taxChildrenStandard: number;
  taxChildrenEnhanced: number;
  taxParentCareCount: number;
  taxLifeInsurance: string | null; // Prisma Decimal serializes to string
  taxHealthInsurance: string | null;
  addressLine: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  createdAt: string;
  updatedAt: string;
  manager: { id: string; firstName: string; lastName: string } | null;
}

/** Flat string-based shape produced by the form; the server re-validates + coerces. */
export interface EmployeeFormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  nationalId?: string;
  maritalStatus?: string;
  branchId?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  hireDate?: string;
  probationEndDate?: string;
  terminationDate?: string;
  compensationType: CompensationType;
  baseSalary?: string;
  dailyRate?: string;
  hourlyRate?: string;
  bankName?: string;
  bankAccountNo?: string;
  taxSpouseNoIncome?: boolean;
  taxChildrenStandard?: string;
  taxChildrenEnhanced?: string;
  taxParentCareCount?: string;
  taxLifeInsurance?: string;
  taxHealthInsurance?: string;
  addressLine?: string;
  district?: string;
  province?: string;
  postalCode?: string;
}

export interface EmployeeQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  departmentId?: string;
  status?: EmployeeStatus;
}

export interface OrgOptions {
  departments: Ref[];
  positions: { id: string; title: string }[];
  branches: Ref[];
  managers: { id: string; firstName: string; lastName: string; employeeCode: string; managerId: string | null; departmentId: string | null }[];
  nextEmployeeCode: string;
}
