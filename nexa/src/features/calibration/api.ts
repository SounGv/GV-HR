import { api, type Envelope } from "@/lib/api/client";
import type {
  CalibrationSessionDetail,
  CalibrationSessionListItem,
  NineBoxGrid,
  ParticipantCalibrationInput,
} from "./types";

export function fetchCalibrationSessions() {
  return api.get<Envelope<CalibrationSessionListItem[]>>("/api/calibration/sessions");
}

export function fetchCalibrationSession(id: string) {
  return api.get<Envelope<CalibrationSessionDetail>>(`/api/calibration/sessions/${id}`);
}

export function createCalibrationSession(input: { campaignId: string; name: string }) {
  return api.post<Envelope<{ id: string }>>("/api/calibration/sessions", input);
}

export function updateParticipantCalibration(
  sessionId: string,
  participantId: string,
  input: ParticipantCalibrationInput,
) {
  return api.patch<Envelope<{ ok: true }>>(
    `/api/calibration/sessions/${sessionId}/participants/${participantId}`,
    input,
  );
}

export function completeCalibrationSession(id: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/calibration/sessions/${id}/complete`);
}

export function fetchNineBoxGrid(campaignId?: string) {
  const qs = campaignId ? `?campaignId=${campaignId}` : "";
  return api.get<Envelope<NineBoxGrid>>(`/api/calibration/nine-box${qs}`);
}
