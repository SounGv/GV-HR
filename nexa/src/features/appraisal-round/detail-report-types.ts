import type { CommentsView } from "./imported-comments";
import type { RaterType } from "./types";

export interface DetailRoundOption {
  id: string;
  name: string;
  status: string;
  dateIso: string | null;
  /** People with a calculated score in this round. */
  people: number;
}

export interface DetailPerson {
  participantId: string;
  employeeId: string;
  name: string;
  code: string;
  department: string;
  position: string;
  avatarUrl: string | null;
  gender: string | null;
  total: number;
  grade: string | null;
  rank: number;
  /** Score in the nearest earlier round this person was scored in. */
  prev: number | null;
  delta: number | null;
  /** How many raters' sheets were submitted for this person in the round. */
  raters: number;
  /** Mean percent per section, in the order of `DetailOverview.sectionNames`; null where the person's form has no such section. */
  sections: (number | null)[];
  /** What the raters wrote (typed answers and imported comments), joined, for the sheet-style table. */
  comment: string;
}

export interface DetailTeam {
  department: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  prevAvg: number | null;
  delta: number | null;
  /** Every person's score, for the dot plot and the spread bars. */
  scores: number[];
}

export interface DetailRoundPoint {
  id: string;
  /** Short month label such as "พ.ย. 69". */
  label: string;
  name: string;
}

export interface DetailHistory {
  rounds: DetailRoundPoint[];
  company: (number | null)[];
  teams: { department: string; values: (number | null)[] }[];
  /** Each person of the chosen round, with the score they had in each of `rounds` (null where not scored). */
  people: { employeeId: string; values: (number | null)[] }[];
}

export interface DetailOverview {
  rounds: DetailRoundOption[];
  roundId: string | null;
  roundName: string;
  status: string;
  ratingMax: number;
  companyAvg: number | null;
  /** Counts of people per score band 0-59, 60-69, 70-79, 80-89, 90-99 and 100. */
  bins: { label: string; from: number; to: number }[];
  /** Section names of the round's forms, the columns of the by-section table. */
  sectionNames: string[];
  people: DetailPerson[];
  teams: DetailTeam[];
  history: DetailHistory;
}

export interface DetailRaterRow {
  assignmentId: string;
  name: string;
  raterType: RaterType;
  /** Share of the overall score this rater's perspective carried; null when the person has no calculated result. */
  weightUsed: number | null;
  /** Plain mean of this sheet as a percent of the scale; null when nothing was rated. */
  percent: number | null;
  status: string;
  submittedAt: string | null;
}

export interface DetailMatrix {
  columns: { assignmentId: string; label: string; raterType: RaterType }[];
  rows: { questionId: string; text: string; section: string; scores: (number | null)[]; avg: number | null }[];
}

export interface DetailComment {
  assignmentId: string;
  raterName: string;
  raterType: RaterType;
  percent: number | null;
  submittedAt: string | null;
  /** Written answers with the question they answer. */
  texts: { question: string; text: string }[];
  /** The example a rater wrote beside a rating. */
  notes: { question: string; score: number; text: string }[];
}

export interface DetailPersonView {
  participantId: string;
  employeeId: string;
  name: string;
  code: string;
  department: string;
  position: string;
  avatarUrl: string | null;
  gender: string | null;
  roundName: string;
  ratingMax: number;
  total: number | null;
  grade: string | null;
  rank: number | null;
  rankOf: number;
  deptAvg: number | null;
  companyAvg: number | null;
  prev: number | null;
  types: { raterType: RaterType; raters: number; percent: number; weightUsed: number }[];
  /** Company-wide mean percent by perspective, to draw against this person. */
  companyTypes: { raterType: RaterType; percent: number }[];
  sections: { name: string; me: number; dept: number | null }[];
  raters: DetailRaterRow[];
  matrix: DetailMatrix;
  comments: DetailComment[];
  imported: CommentsView | null;
  history: { rounds: DetailRoundPoint[]; me: (number | null)[]; dept: (number | null)[]; company: (number | null)[] };
}
