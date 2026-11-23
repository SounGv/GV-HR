/**
 * The four popular Thai PMS methods, plus Competency split into Core /
 * Functional / Leadership. Pure — checked by scripts/check-appraisal-form.mjs.
 *
 * A form section picks one of these; CUSTOM is a blank section. Starter
 * questions are suggestions HR can edit — they are not locked.
 */

export type SectionKind =
  | "KPI"
  | "OKR"
  | "COMPETENCY_CORE"
  | "COMPETENCY_FUNCTIONAL"
  | "COMPETENCY_LEADERSHIP"
  | "TASK"
  | "CUSTOM";

export type MethodAnswerType =
  "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH" | "FILE_EVIDENCE";

export interface MethodQuestion {
  text: string;
  helpText: string;
  answerType: MethodAnswerType;
  weight: number;
  required: boolean;
}

export interface MethodTemplate {
  kind: SectionKind;
  name: string;
  short: string;
  hint: string;
  questions: MethodQuestion[];
}

export const SECTION_KIND_LABEL: Record<SectionKind, string> = {
  KPI: "KPI",
  OKR: "OKR",
  COMPETENCY_CORE: "สมรรถนะหลัก",
  COMPETENCY_FUNCTIONAL: "สมรรถนะตามหน่วยงาน",
  COMPETENCY_LEADERSHIP: "สมรรถนะผู้นำ",
  TASK: "ผลงานตามหน้าที่",
  CUSTOM: "หมวดกำหนดเอง",
};

export const METHOD_TEMPLATES: readonly MethodTemplate[] = [
  {
    kind: "KPI",
    name: "KPI — ดัชนีชี้วัดความสำเร็จ",
    short: "KPI",
    hint: "เป้าตัวเลขจากองค์กรถ่ายทอดลงมา วัดเป็นจำนวน/ปริมาณได้ชัด",
    questions: [
      {
        text: "บรรลุเป้าหมายตัวเลขตามที่ได้รับมอบหมาย",
        helpText: "เทียบผลจริงกับเป้าที่ตั้งไว้ในรอบนี้ (ยอดขาย, จำนวนงาน, อัตราความสำเร็จ ฯลฯ)",
        answerType: "RATING",
        weight: 5,
        required: true,
      },
      {
        text: "คุณภาพของผลลัพธ์เมื่อเทียบกับมาตรฐานที่กำหนด",
        helpText: "ไม่ใช่แค่ทำครบเป้า แต่ผลลัพธ์ใช้ได้จริงตามเกณฑ์",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "หมายเหตุ / หลักฐานตัวเลข",
        helpText: "สรุปตัวเลขจริงเทียบเป้า หรืออธิบายหากต่ำกว่าเป้า",
        answerType: "PARAGRAPH",
        weight: 0,
        required: false,
      },
    ],
  },
  {
    kind: "OKR",
    name: "OKR — วัตถุประสงค์และผลลัพธ์หลัก",
    short: "OKR",
    hint: "เป้าใหญ่ขององค์กร + พนักงานร่วมตั้งเป้าที่สอดคล้อง",
    questions: [
      {
        text: "ความก้าวหน้าของ Objective ที่ตั้งไว้",
        helpText: "วัตถุประสงค์ใหญ่ของรอบนี้เดินไปไกลแค่ไหน",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "Key Results สำเร็จตามที่วัดได้",
        helpText: "ผลลัพธ์ย่อยที่ใช้รู้ว่าบรรลุวัตถุประสงค์แล้ว",
        answerType: "RATING",
        weight: 5,
        required: true,
      },
      {
        text: "ความสอดคล้องกับเป้าใหญ่ขององค์กร / ทีม",
        helpText: "งานนี้ดึงองค์กรไปทางเดียวกับเป้าใหญ่หรือไม่",
        answerType: "RATING",
        weight: 2,
        required: true,
      },
    ],
  },
  {
    kind: "COMPETENCY_CORE",
    name: "สมรรถนะหลัก (Core)",
    short: "Core",
    hint: "พฤติกรรมที่พนักงานทุกคน ทุกระดับต้องมีร่วมกัน",
    questions: [
      {
        text: "ความรับผิดชอบต่องานและคำมั่นสัญญา",
        helpText: "รับงานแล้วทำให้จบ ไม่ผลักความรับผิดชอบ",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "การทำงานร่วมกับผู้อื่น",
        helpText: "สื่อสารชัด ช่วยทีม และเคารพความต่าง",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "การปฏิบัติตามค่านิยมและกฎขององค์กร",
        helpText: "ทำตัวเป็นตัวอย่างของวัฒนธรรมที่องค์กรต้องการ",
        answerType: "RATING",
        weight: 2,
        required: true,
      },
    ],
  },
  {
    kind: "COMPETENCY_FUNCTIONAL",
    name: "สมรรถนะตามหน่วยงาน (Functional)",
    short: "Functional",
    hint: "ความรู้และทักษะเฉพาะขอบเขตงานของหน่วยงาน",
    questions: [
      {
        text: "ความรู้และทักษะเฉพาะตำแหน่ง",
        helpText: "ใช้เครื่องมือ / กระบวนการของหน่วยงานนี้ได้ถูกต้อง",
        answerType: "RATING",
        weight: 4,
        required: true,
      },
      {
        text: "คุณภาพงานตามมาตรฐานวิชาชีพของหน่วยงาน",
        helpText: "ผลงานผ่านเกณฑ์ที่หน่วยงานกำหนด",
        answerType: "RATING",
        weight: 4,
        required: true,
      },
      {
        text: "การพัฒนาทักษะเฉพาะทางในรอบนี้",
        helpText: "เรียนรู้สิ่งใหม่ที่เกี่ยวข้องกับหน้าที่",
        answerType: "RATING",
        weight: 2,
        required: true,
      },
    ],
  },
  {
    kind: "COMPETENCY_LEADERSHIP",
    name: "สมรรถนะผู้นำ (Leadership)",
    short: "Leadership",
    hint: "สำหรับหัวหน้างานและผู้บริหาร — มองข้ามได้ถ้าผู้ถูกประเมินไม่ใช่หัวหน้า",
    questions: [
      {
        text: "การตั้งทิศทางและสื่อสารเป้าหมายให้ทีม",
        helpText: "ทีมรู้ว่าต้องไปทางไหน และทำไม",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "การโค้ชและพัฒนาลูกทีม",
        helpText: "ให้ฟีดแบ็กที่ใช้ได้ และเปิดโอกาสให้คนโต",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "การตัดสินใจเมื่อมีข้อมูลไม่ครบ",
        helpText: "ตัดสินแล้วรับผิดชอบผล ไม่ผลักให้ลูกทีม",
        answerType: "RATING",
        weight: 2,
        required: true,
      },
    ],
  },
  {
    kind: "TASK",
    name: "ผลงานตามหน้าที่ (Task Achievement)",
    short: "หน้าที่",
    hint: "วัดคุณภาพ ความสมบูรณ์ และการส่งงานตรงเวลา ตามหน้าที่ของตำแหน่ง — แนบหลักฐานได้",
    questions: [
      {
        text: "คุณภาพของงานตามหน้าที่ที่ได้รับมอบหมาย",
        helpText: "ผลงานถูกต้อง ใช้ได้ และได้มาตรฐานของตำแหน่ง",
        answerType: "RATING",
        weight: 4,
        required: true,
      },
      {
        text: "ความสมบูรณ์ของงาน",
        helpText: "ส่งครบทุกส่วนที่ต้องทำ ไม่ขาดชิ้นสำคัญ",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "ส่งงานได้ทันตามกำหนดเวลา",
        helpText: "ไม่เลื่อนโดยไม่มีเหตุ และแจ้งล่วงหน้าเมื่อมีปัญหา",
        answerType: "RATING",
        weight: 3,
        required: true,
      },
      {
        text: "หลักฐานการทำงาน",
        helpText: "แนบรายงาน ภาพหน้าจอ หรือเอกสารที่พิสูจน์ผลงานในรอบนี้",
        answerType: "FILE_EVIDENCE",
        weight: 0,
        required: false,
      },
    ],
  },
];

export const CUSTOM_SECTION: MethodTemplate = {
  kind: "CUSTOM",
  name: "หมวดกำหนดเอง",
  short: "กำหนดเอง",
  hint: "ตั้งชื่อหมวดและหัวข้อเอง",
  questions: [{ text: "", helpText: "", answerType: "RATING", weight: 1, required: true }],
};

const KINDS = new Set<string>([...METHOD_TEMPLATES.map((t) => t.kind), CUSTOM_SECTION.kind]);

/** Unknown / missing values become CUSTOM so old snapshots still group as a plain section. */
export function parseSectionKind(value: unknown): SectionKind {
  return typeof value === "string" && KINDS.has(value) ? (value as SectionKind) : "CUSTOM";
}

export function templateFor(kind: SectionKind): MethodTemplate {
  return METHOD_TEMPLATES.find((t) => t.kind === kind) ?? CUSTOM_SECTION;
}
