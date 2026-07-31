export type TrainingStatus = "OPEN" | "CLOSED";
export type EnrollmentStatus = "ENROLLED" | "COMPLETED" | "CANCELLED";

export interface TrainingCourse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  provider: string | null;
  hours: number;
  location: string | null;
  scheduledDate: string | null;
  capacity: number | null;
  status: TrainingStatus;
  enrolledCount: number;
  myEnrollment: { id: string; status: EnrollmentStatus } | null;
}

export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  score: number | null;
  completedAt: string | null;
  course: {
    id: string;
    title: string;
    category: string;
    hours: number;
    scheduledDate: string | null;
  };
}

export interface CourseFormValues {
  title: string;
  description?: string;
  category: string;
  provider?: string;
  hours: string;
  location?: string;
  scheduledDate?: string;
  capacity?: string;
  status: TrainingStatus;
}
