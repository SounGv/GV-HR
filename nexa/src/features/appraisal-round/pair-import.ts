/**
 * Reads a pasted list of "who rates whom" into pairs (pure, no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-raters.mjs`).
 *
 * One line per pair: `rater | ratee | type`. The type may be left out and then the default is used. People are found by
 * name (first name and surname, nickname in brackets ignored), because the lists come from another system whose codes do
 * not match ours. Nothing is guessed: a name with no match, or with two matches, is reported and its line is not used.
 */

export type PairRaterType = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";

export interface NamedPerson {
  id: string;
  /** Display name, e.g. "สมชาย ใจดี (ชาย)". */
  name: string;
}

export type PairProblemKind = "FORMAT" | "NO_RATER" | "NO_RATEE" | "AMBIGUOUS_RATER" | "AMBIGUOUS_RATEE" | "BAD_TYPE" | "BAD_PAIR" | "DUPLICATE";

export interface PairProblem {
  line: number;
  text: string;
  kind: PairProblemKind;
}

export interface ParsedPairs {
  pairs: { participantId: string; raterId: string; raterType: PairRaterType }[];
  problems: PairProblem[];
}

const TYPE_WORDS: Record<string, PairRaterType> = {
  หัวหน้า: "MANAGER",
  ลูกน้อง: "SUBORDINATE",
  เพื่อน: "PEER",
  เพื่อนร่วมงาน: "PEER",
  ตนเอง: "SELF",
  ตัวเอง: "SELF",
  MANAGER: "MANAGER",
  SUBORDINATE: "SUBORDINATE",
  PEER: "PEER",
  SELF: "SELF",
};

const squash = (s: string) => s.replace(/[\s​ ]+/g, "");
/** "สมชาย ใจดี (ชาย)" -> "สมชายใจดี" */
const keyOf = (s: string) => squash(s.replace(/\([^)]*\)\s*$/, ""));

export function parsePairLines(text: string, people: readonly NamedPerson[], defaultType: PairRaterType): ParsedPairs {
  const byName = new Map<string, NamedPerson[]>();
  for (const p of people) {
    const k = keyOf(p.name);
    byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  const pairs: ParsedPairs["pairs"] = [];
  const problems: PairProblem[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const fail = (kind: PairProblemKind) => {
      problems.push({ line: i + 1, text: line, kind });
    };
    const parts = line.split(/[|\t]/).map((x) => x.trim());
    if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) return fail("FORMAT");
    let type = defaultType;
    if (parts[2]) {
      const t = TYPE_WORDS[parts[2]] ?? TYPE_WORDS[parts[2].toUpperCase()];
      if (!t) return fail("BAD_TYPE");
      type = t;
    }
    const raters = byName.get(keyOf(parts[0])) ?? [];
    const ratees = byName.get(keyOf(parts[1])) ?? [];
    if (raters.length === 0) return fail("NO_RATER");
    if (raters.length > 1) return fail("AMBIGUOUS_RATER");
    if (ratees.length === 0) return fail("NO_RATEE");
    if (ratees.length > 1) return fail("AMBIGUOUS_RATEE");
    const rater = raters[0]!;
    const ratee = ratees[0]!;
    if (type === "SELF" ? rater.id !== ratee.id : rater.id === ratee.id) return fail("BAD_PAIR");
    const key = `${ratee.id}|${rater.id}|${type}`;
    if (seen.has(key)) return fail("DUPLICATE");
    seen.add(key);
    pairs.push({ participantId: ratee.id, raterId: rater.id, raterType: type });
  });
  return { pairs, problems };
}
