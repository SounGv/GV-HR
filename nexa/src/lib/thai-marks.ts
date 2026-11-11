/**
 * Thai stacked-mark handling for jsPDF.
 *
 * jsPDF draws characters one after another with no OpenType shaping, so two
 * kinds of above-marks go missing in exported PDFs (browsers fix both with
 * the font's GPOS table, which jsPDF ignores):
 *
 * 1. A tone mark (่ ้ ๊ ๋) or thanthakhat (์) on top of an upper vowel
 *    (ั ิ ี ึ ื ํ), or in front of sara am (ำ), lands at its default height,
 *    exactly on the vowel: "ที่" printed as "ที". It has to be raised.
 * 2. Any above-mark on a tall consonant (ป ฝ ฟ ฬ) lands on the consonant's
 *    stem; a thin ่ disappears into it: "ป่า" printed as "ปา". It has to move
 *    left, off the stem.
 *
 * So those marks are taken out of the string, the rest prints normally, and
 * each one is drawn again in the right place. The marks have zero width, so
 * the base text's width up to that point is exactly where each one belongs.
 */

const ABOVE_MARK = /[ัิ-ื็-ํ]/;
const TONE_OR_THANTHAKHAT = /[่-์]/;
const UPPER_VOWEL = /[ัิ-ืํ]/;
const TALL_CONSONANT = /[ปฝฟฬ]/;
const CONSONANT = /[ก-ฮ]/;
const SARA_AM = "ำ";

export interface PlacedMark {
  /** How many characters of `base` come before the mark. */
  at: number;
  mark: string;
  /** Lift it above an upper vowel / sara am's circle. */
  raise: boolean;
  /** Move it left, off a tall consonant's stem. */
  shiftLeft: boolean;
}

/**
 * Splits a line into the text to print normally and the marks that must be
 * drawn separately.
 *
 * @param line One line of text (no newlines).
 */
export function splitStackedMarks(line: string): { base: string; marks: PlacedMark[] } {
  let base = "";
  const marks: PlacedMark[] = [];
  const chars = [...line];
  let consonant = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (CONSONANT.test(ch)) consonant = ch;
    else if (!ABOVE_MARK.test(ch) && !/[ุ-ฺ]/.test(ch)) consonant = "";

    if (ABOVE_MARK.test(ch)) {
      const prev = chars[i - 1] ?? "";
      const next = chars[i + 1] ?? "";
      const raise = TONE_OR_THANTHAKHAT.test(ch) && (UPPER_VOWEL.test(prev) || next === SARA_AM);
      const shiftLeft = TALL_CONSONANT.test(consonant);
      if (raise || shiftLeft) {
        marks.push({ at: base.length, mark: ch, raise, shiftLeft });
        continue;
      }
    }
    base += ch;
  }
  return { base, marks };
}
