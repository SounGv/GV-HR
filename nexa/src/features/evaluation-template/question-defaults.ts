import type { AnswerType, TemplateOption } from "./types";

/** Sensible starting options per answer type, used both when authoring a
 * fresh question in the builder and when pulling one in from the Question
 * Bank (see bank-question-picker.tsx) — kept in its own module so those two
 * files can both import it without creating a circular dependency between
 * them. */
export function defaultOptionsFor(type: AnswerType): TemplateOption[] | undefined {
  switch (type) {
    case "NUMERIC":
      return [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n), score: n }));
    case "YES_NO":
      return [
        { value: "YES", label: "ใช่", score: 1 },
        { value: "NO", label: "ไม่ใช่", score: 0 },
      ];
    case "LETTER":
      return [
        { value: "A", label: "A", score: 4 },
        { value: "B", label: "B", score: 3 },
        { value: "C", label: "C", score: 2 },
        { value: "D", label: "D", score: 1 },
      ];
    case "CHOICE":
      return [
        { value: "", label: "", score: 0 },
        { value: "", label: "", score: 0 },
      ];
    case "LONG_TEXT":
    case "SHORT_TEXT":
    case "FILE_EVIDENCE":
      return undefined;
  }
}
