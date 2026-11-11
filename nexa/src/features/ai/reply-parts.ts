/** Pure helpers for splitting an AI Assistant reply (Markdown) into its parts. */

/** Split a reply into the short summary (first paragraph) and the rest. */
export function splitSummary(md: string): { summary: string; rest: string } {
  const trimmed = md.trim();
  const blocks = trimmed.split(/\n\s*\n/);
  const first = blocks[0] ?? "";
  // A heading or table first means there is no prose summary to lift out.
  if (/^\s*(#|\|)/.test(first)) return { summary: "", rest: trimmed };
  return { summary: first.replace(/\n/g, " ").trim(), rest: blocks.slice(1).join("\n\n").trim() };
}

/** First heading text, used as the result panel's title. */
export function firstHeading(md: string): string | null {
  const m = /^\s*#{1,4}\s+(.+)$/m.exec(md);
  return m ? m[1].replace(/\*\*/g, "").trim() : null;
}

/** The text with its first heading line removed (that heading is shown as the panel title instead). */
export function withoutFirstHeading(md: string): string {
  return md.replace(/^\s*#{1,4}\s+.+$/m, "").trim();
}
