export type JobStatus = "OPEN" | "CLOSED";
export type CandidateStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED";

export interface Job {
  id: string;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  description: string | null;
  location: string | null;
  employmentType: string;
  openings: number;
  status: JobStatus;
  candidateCount: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  stage: CandidateStage;
  createdAt: string;
  jobPosting: { id: string; title: string };
}

export interface JobFormValues {
  title: string;
  departmentId?: string;
  description?: string;
  location?: string;
  employmentType: string;
  openings: string;
  status: JobStatus;
}

export interface CandidateFormValues {
  jobPostingId: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  stage: CandidateStage;
}
