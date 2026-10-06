import type { AnswerType, FormStatus } from "./rules";

export type { AnswerType, FormStatus };
export type RaterType = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";

export const ANSWER_TYPE_LABEL: Record<AnswerType, string> = {
  RATING: "ให้คะแนน",
  CHOICE: "เลือกหนึ่งข้อ",
  MULTI_CHOICE: "เลือกได้หลายข้อ",
  SHORT_TEXT: "คำตอบสั้น",
  PARAGRAPH: "ย่อหน้า",
};

export const RATER_LABEL: Record<RaterType, string> = {
  SELF: "ตนเอง",
  MANAGER: "หัวหน้า",
  PEER: "เพื่อนร่วมงาน",
  SUBORDINATE: "ลูกน้อง",
};

export const STATUS_LABEL: Record<FormStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "ใช้งานแล้ว",
  ARCHIVED: "เลิกใช้",
};

export interface FormListItem {
  id: string;
  lineageId: string;
  version: number;
  name: string;
  status: FormStatus;
  questionCount: number;
  updatedAt: string;
}

export interface QuestionDetail {
  id: string;
  order: number;
  text: string;
  helpText: string | null;
  answerType: AnswerType;
  options: { value: string; label: string }[] | null;
  weight: number;
  required: boolean;
  visibleTo: RaterType[];
}

export interface FormDetail {
  id: string;
  lineageId: string;
  version: number;
  name: string;
  description: string | null;
  status: FormStatus;
  ratingMax: number;
  publishedAt: string | null;
  questions: QuestionDetail[];
}

/** One question as the editor holds it (a stable key for React before it has an id). */
export interface QuestionValues {
  uiKey: string;
  text: string;
  helpText: string;
  answerType: AnswerType;
  options: { value: string; label: string }[];
  weight: number;
  required: boolean;
  visibleTo: RaterType[];
}
