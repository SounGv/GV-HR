"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCalibrationSessions,
  fetchCalibrationSession,
  createCalibrationSession,
  updateParticipantCalibration,
  completeCalibrationSession,
  fetchNineBoxGrid,
} from "./api";
import type { ParticipantCalibrationInput } from "./types";

export const calibrationKeys = {
  all: ["calibration"] as const,
  sessions: ["calibration", "sessions"] as const,
  session: (id: string) => ["calibration", "sessions", id] as const,
  nineBox: (campaignId?: string) => ["calibration", "nine-box", campaignId ?? "all"] as const,
};

export function useCalibrationSessions() {
  return useQuery({ queryKey: calibrationKeys.sessions, queryFn: fetchCalibrationSessions });
}

export function useCalibrationSession(id: string) {
  return useQuery({ queryKey: calibrationKeys.session(id), queryFn: () => fetchCalibrationSession(id) });
}

export function useNineBoxGrid(campaignId?: string) {
  return useQuery({
    queryKey: calibrationKeys.nineBox(campaignId),
    queryFn: () => fetchNineBoxGrid(campaignId),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: calibrationKeys.all });
}

export function useCreateCalibrationSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { campaignId: string; name: string }) => createCalibrationSession(input),
    onSuccess: invalidate,
  });
}

export function useUpdateParticipantCalibration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { sessionId: string; participantId: string; input: ParticipantCalibrationInput }) =>
      updateParticipantCalibration(v.sessionId, v.participantId, v.input),
    onSuccess: invalidate,
  });
}

export function useCompleteCalibrationSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => completeCalibrationSession(id),
    onSuccess: invalidate,
  });
}
