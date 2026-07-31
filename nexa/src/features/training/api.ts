import { api, type Envelope } from "@/lib/api/client";
import type {
  CourseFormValues,
  TrainingCourse,
  MyEnrollment,
  EnrollmentStatus,
} from "./types";

export function fetchCourses() {
  return api.get<Envelope<TrainingCourse[]>>("/api/training");
}

export function fetchMyEnrollments() {
  return api.get<Envelope<MyEnrollment[]>>("/api/training/enrollments");
}

export function createCourse(input: CourseFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/training", input);
}

export function updateCourse(id: string, input: Partial<CourseFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/training/${id}`, input);
}

export function deleteCourse(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/training/${id}`);
}

export function enrollCourse(id: string) {
  return api.post<Envelope<{ id: string }>>(`/api/training/${id}/enroll`, {});
}

export function cancelEnrollment(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/training/enrollments/${id}`);
}

export function gradeEnrollment(id: string, status: EnrollmentStatus, score?: string) {
  return api.patch<Envelope<{ id: string }>>(`/api/training/enrollments/${id}`, { status, score });
}
