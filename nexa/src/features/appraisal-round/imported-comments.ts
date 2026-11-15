/**
 * Written comments copied from another system (Favpo) for a round that has no answer sheets of its own
 * (pure, no imports; checked by `node --experimental-strip-types scripts/check-imported-comments.mjs`).
 *
 * The comments belong to the person and the round, never to whoever wrote them. A group of peers or subordinates is
 * only shown once enough of them rated, the same rule live answers follow, so a comment cannot point at its author.
 */

/** A group of peers or subordinates is only shown on its own once at least this many have answered, so nobody can be identified. */
export const ANON_MIN = 3;
/** These are the people who can be identified whatever the group size (they are one person by definition). */
export const NAMED_TYPES: ReadonlySet<string> = new Set(["SELF", "MANAGER"]);

export interface ImportedComments {
  source: string;
  raterType: string;
  /** How many people rated in this round, as Favpo reported it. */
  raters: number;
  texts: string[];
}

export interface CommentsView {
  raterType: string;
  raters: number;
  /** Empty when hidden. */
  texts: string[];
  /** True when the texts exist but are held back; the page says why instead of showing nothing. */
  hidden: boolean;
  /** How many comments are held back. */
  hiddenCount: number;
}

/** Reads the stored JSON defensively: anything that is not the expected shape is treated as no comments. */
export function parseImportedComments(raw: unknown): ImportedComments | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.raterType !== "string" || !Array.isArray(r.texts)) return null;
  const texts = r.texts.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  if (texts.length === 0) return null;
  return { source: typeof r.source === "string" ? r.source : "import", raterType: r.raterType, raters: typeof r.raters === "number" ? r.raters : 0, texts };
}

/**
 * What a viewer may read. HR (who can open every result already and could read the same comments in the source system) see
 * everything; anyone else sees a group of peers or subordinates only when at least `ANON_MIN` of them rated.
 */
export function commentsFor(c: ImportedComments | null, isHr: boolean): CommentsView | null {
  if (!c) return null;
  const named = NAMED_TYPES.has(c.raterType);
  const show = isHr || named || c.raters >= ANON_MIN;
  return { raterType: c.raterType, raters: c.raters, texts: show ? c.texts : [], hidden: !show, hiddenCount: show ? 0 : c.texts.length };
}
