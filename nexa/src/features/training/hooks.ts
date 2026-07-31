"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCourses,
  fetchMyEnrollments,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollCourse,
  cancelEnrollment,
  gradeEnrollment,
} from "./api";
import type { CourseFormValues, EnrollmentStatus } from "./types";

export const trainingKeys = {
  all: ["training"] as const,
  courses: ["training", "courses"] as const,
  myEnrollments: ["training", "my-enrollments"] as const,
};

export function useCourses() {
  return useQuery({
    queryKey: trainingKeys.courses,
    queryFn: fetchCourses,
    placeholderData: (prev) => prev,
  });
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: trainingKeys.myEnrollments,
    queryFn: fetchMyEnrollments,
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: trainingKeys.all });
}

export function useCreateCourse() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: CourseFormValues) => createCourse(i), onSuccess: invalidate });
}

export function useUpdateCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<CourseFormValues> }) => updateCourse(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteCourse() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteCourse(id), onSuccess: invalidate });
}

export function useEnroll() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => enrollCourse(id), onSuccess: invalidate });
}

export function useCancelEnrollment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cancelEnrollment(id), onSuccess: invalidate });
}

export function useGradeEnrollment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; status: EnrollmentStatus; score?: string }) =>
      gradeEnrollment(v.id, v.status, v.score),
    onSuccess: invalidate,
  });
}
