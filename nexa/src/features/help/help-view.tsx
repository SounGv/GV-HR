import { Lightbulb } from "lucide-react";
import { GUIDE_SECTIONS } from "./guide-content";

/**
 * Dense, anchor-navigable manual — table of contents up top, then every
 * section in full: numbered procedures with sub-steps, reference tables,
 * inline tips. No screenshots/mockups; UI is referenced by menu/button name
 * only, matching the reference format this was asked to follow.
 */
export function HelpView() {
  return (
    <div className="space-y-8">
      <nav aria-label="สารบัญ" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">สารบัญ</p>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-sm font-medium text-primary hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map((section, i) => (
        <section key={section.id} id={section.id} className="scroll-mt-20 space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="font-heading text-xl font-bold text-foreground">
              {i + 1}. {section.title}
            </h2>
            <p className="text-xs font-semibold text-primary">{section.roleLabel}</p>
            {section.intro && <p className="mt-1 text-sm text-muted-foreground">{section.intro}</p>}
          </div>

          {section.procedures?.map((proc) => (
            <div key={proc.title} className="space-y-2">
              <h3 className="text-[15px] font-semibold text-foreground">{proc.title}</h3>
              <ol className="space-y-2.5">
                {proc.steps.map((step, si) => (
                  <li key={si} className="flex gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      {si + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground">{step.text}</p>
                      {step.sub && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-muted-foreground marker:text-border">
                          {step.sub.map((s, ssi) => (
                            <li key={ssi}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {section.tables?.map((table) => (
            <div key={table.caption} className="space-y-1.5">
              <p className="text-[13px] font-semibold text-muted-foreground">{table.caption}</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {table.headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold text-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {table.rows.map((row, ri) => (
                      <tr key={ri} className="odd:bg-card even:bg-muted/20">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 align-top text-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {section.tips && section.tips.length > 0 && (
            <div className="space-y-2 rounded-lg bg-secondary/60 p-3">
              {section.tips.map((tip, ti) => (
                <p key={ti} className="flex gap-2 text-[13px] text-secondary-foreground">
                  <Lightbulb className="size-4 shrink-0" />
                  <span>{tip}</span>
                </p>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
