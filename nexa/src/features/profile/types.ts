export interface MyProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  maritalStatus: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | null;
  addressLine: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankBranch: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  // Read-only (HR-controlled) context
  status: string;
  hireDate: string | null;
  department: { name: string } | null;
  position: { title: string } | null;
  branch: { name: string } | null;
  updatedAt: string;
}
