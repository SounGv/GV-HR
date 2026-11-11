import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A small, safe Markdown renderer for AI Assistant replies. Claude answers in
 * Markdown (headings, bold, lists, pipe tables); shown as plain text the
 * `##`, `|` and `**` came through raw. This covers exactly what the replies
 * use and builds React elements only — no HTML string is ever injected, so a
 * reply can't smuggle markup into the page.
 */

/** Inline: **bold**, *italic*, `code`. Everything else stays text. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.92em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isDivider = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
/** Right-align columns whose body cells are all numbers (counts, %, minutes). */
const numericCol = (rows: string[][], c: number) =>
  rows.length > 0 && rows.every((r) => /^[-+]?[\d,.]+\s*(%|ครั้ง|วัน|คน|นาที|ชม\.?|บาท)?$/.test((r[c] ?? "").replace(/\*/g, "")));

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = `b${k++}`;
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <p
          key={key}
          role="heading"
          aria-level={Math.min(level + 1, 6)}
          className={cn("font-semibold text-foreground", level <= 2 ? "mt-1 text-[15px]" : "mt-3 text-[13.5px]")}
        >
          {inline(h[2], key)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={key} className="my-2 border-border" />);
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) body.push(cells(lines[i++]));
      const num = head.map((_, c) => numericCol(body, c));
      // Narrow places (the floating AI panel, phones) can't fit a 4–6 column
      // table: names wrapped letter by letter and the right columns fell off.
      // Below 32rem of width each row becomes a small card instead.
      const rankCol = head.findIndex((h) => /^(#|อันดับ|ลำดับ|ที่)$/.test(h.replace(/\*/g, "").trim()));
      const nameIdx = head.findIndex((h, ci) => ci !== rankCol && /ชื่อ|พนักงาน|แผนก/.test(h));
      const titleCol = nameIdx >= 0 ? nameIdx : head.findIndex((_, ci) => ci !== rankCol);
      const cardList = (
        <ol className="space-y-1.5 @lg:hidden">
          {body.map((r, ri) => (
            <li key={ri} className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="flex items-baseline gap-2 font-semibold text-foreground">
                {rankCol >= 0 && (
                  <span className="inline-grid size-5 shrink-0 place-items-center rounded-md bg-[#0f766e] text-[11px] text-white tabular-nums">
                    {r[rankCol]}
                  </span>
                )}
                <span className="min-w-0">{inline(r[titleCol] ?? "", `${key}t${ri}`)}</span>
              </p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
                {head.map((h, ci) =>
                  ci === rankCol || ci === titleCol || !(r[ci] ?? "").trim() ? null : (
                    <Fragment key={ci}>
                      <dt className="text-muted-foreground">{inline(h, `${key}d${ri}h${ci}`)}</dt>
                      <dd className={cn("text-foreground", num[ci] && "font-semibold tabular-nums")}>{inline(r[ci] ?? "", `${key}d${ri}c${ci}`)}</dd>
                    </Fragment>
                  ),
                )}
              </dl>
            </li>
          ))}
        </ol>
      );
      const compactable = head.length > 2 && titleCol >= 0;
      blocks.push(
        <div key={key} className="@container my-1">
        {compactable && cardList}
        <div className={cn("overflow-x-auto rounded-xl border border-border", compactable && "hidden @lg:block")}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th
                    key={ci}
                    className={cn(
                      "border-b border-border bg-[#f8fafb] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground dark:bg-muted",
                      num[ci] ? "text-right" : "text-left",
                    )}
                  >
                    {inline(c, `${key}h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="hover:bg-[#f6f8f9] dark:hover:bg-white/5">
                  {head.map((_, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-border/60 px-2.5 py-1.5 align-top",
                        num[ci] && "text-right tabular-nums",
                      )}
                    >
                      {inline(r[ci] ?? "", `${key}r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} className={cn("space-y-0.5 pl-5", ordered ? "list-decimal" : "list-disc")}>
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `${key}i${ii}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !isTableRow(lines[i]) &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key}>
        {para.map((p, pi) => (
          <Fragment key={pi}>
            {pi > 0 && <br />}
            {inline(p, `${key}p${pi}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={cn("space-y-2 text-sm leading-relaxed break-words", className)}>{blocks}</div>;
}
