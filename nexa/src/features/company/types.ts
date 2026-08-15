export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  brandColor: string | null;
  timezone: string;
  currency: string;
  language: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  addressLine: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  attendanceDeductionEnabled: boolean;
  lateDeductionPerOccurrence: string; // Prisma Decimal serializes to string
  updatedAt: string;
}
