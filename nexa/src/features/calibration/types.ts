export type CalibrationSessionStatus = "DRAFT" | "COMPLETED";
export type PotentialLevel = "LOW" | "MEDIUM" | "HIGH";

export interface CalibrationSessionListItem {
  id: string;
  name: string;
  status: CalibrationSessionStatus;
  completedAt: string | null;
  createdAt: string;
  campaign: { id: string; name: string; cycle: string };
  participantCount: number;
}

export interface CalibrationParticipant {
  id: string;
  overallScore: number | null;
  band: string | null;
  finalizedAt: string | null;
  calibratedScore: number | null;
  calibratedBand: string | null;
  potential: PotentialLevel | null;
  potentialNote: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    managerId: string | null;
  };
}

export interface CalibrationSessionDetail {
  id: string;
  name: string;
  status: CalibrationSessionStatus;
  notes: string | null;
  completedAt: string | null;
  campaign: { id: string; name: string; cycle: string };
  participants: CalibrationParticipant[];
}

export interface ParticipantCalibrationInput {
  calibratedScore?: number;
  calibratedBand?: string;
  potential?: PotentialLevel;
  potentialNote?: string;
}

export interface NineBoxEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export type NineBoxTier = "LOW" | "MEDIUM" | "HIGH";
export type NineBoxGrid = Record<NineBoxTier, Record<NineBoxTier, NineBoxEmployee[]>>;
