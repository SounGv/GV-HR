export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  breakMinutes: number;
}

export interface ShiftAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  employeeId: string;
  note: string | null;
  template: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  };
}

export interface TemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  breakMinutes: string;
}
