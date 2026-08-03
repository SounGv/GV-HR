import { api, type Envelope } from "@/lib/api/client";
import type { Recognition, RecognitionFormValues, RecognitionScope, RecognitionSummary } from "./types";

export function fetchRecognition(scope: RecognitionScope) {
  return api.get<Envelope<Recognition[]>>(`/api/recognition?scope=${scope}`);
}

export function fetchRecognitionSummary(employeeId: string) {
  return api.get<Envelope<RecognitionSummary>>(`/api/recognition/summary/${employeeId}`);
}

export function createRecognition(input: RecognitionFormValues) {
  return api.post<Envelope<Recognition>>("/api/recognition", input);
}
