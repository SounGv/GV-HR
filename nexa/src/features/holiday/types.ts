export type HolidayType = "COMPANY" | "NATIONAL";

export interface Holiday {
  id: string;
  date: string; // ISO
  name: string;
  type: HolidayType;
  notifyEnabled: boolean;
}

export interface HolidayFormValues {
  date: string;
  name: string;
  type: HolidayType;
  notifyEnabled: boolean;
}
