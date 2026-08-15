import type { EmployeeDetail, EmployeeFormValues } from "./types";

function dateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : undefined;
}

/** Map a fetched employee record onto the flat form-values shape. */
export function toFormValues(e: EmployeeDetail): Partial<EmployeeFormValues> {
  return {
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    firstNameEn: e.firstNameEn ?? undefined,
    lastNameEn: e.lastNameEn ?? undefined,
    nickname: e.nickname ?? undefined,
    avatarUrl: e.avatarUrl ?? undefined,
    email: e.email ?? undefined,
    phone: e.phone ?? undefined,
    gender: e.gender ?? undefined,
    dateOfBirth: dateInput(e.dateOfBirth),
    nationalId: e.nationalId ?? undefined,
    maritalStatus: e.maritalStatus ?? undefined,
    branchId: e.branch?.id,
    departmentId: e.department?.id,
    positionId: e.position?.id,
    managerId: e.manager?.id,
    employmentType: e.employmentType,
    status: e.status,
    hireDate: dateInput(e.hireDate),
    probationEndDate: dateInput(e.probationEndDate),
    terminationDate: dateInput(e.terminationDate),
    compensationType: e.compensationType,
    baseSalary: e.baseSalary ?? undefined,
    dailyRate: e.dailyRate ?? undefined,
    hourlyRate: e.hourlyRate ?? undefined,
    bankName: e.bankName ?? undefined,
    bankAccountNo: e.bankAccountNo ?? undefined,
    taxSpouseNoIncome: e.taxSpouseNoIncome,
    taxChildrenStandard: String(e.taxChildrenStandard),
    taxChildrenEnhanced: String(e.taxChildrenEnhanced),
    taxParentCareCount: String(e.taxParentCareCount),
    taxLifeInsurance: e.taxLifeInsurance ?? undefined,
    taxHealthInsurance: e.taxHealthInsurance ?? undefined,
    addressLine: e.addressLine ?? undefined,
    district: e.district ?? undefined,
    province: e.province ?? undefined,
    postalCode: e.postalCode ?? undefined,
  };
}
