import { Lightbulb, ListOrdered } from "lucide-react";
import { GUIDE_SECTIONS } from "./guide-content";
import { EvalStepIllustration } from "./evaluation-step-illustration";

/**
 * Dense, anchor-navigable manual — table of contents up top, then every
 * section in full: numbered procedures with sub-steps, reference tables,
 * inline tips. No screenshots/mockups; UI is referenced by menu/button name
 * only. Each section reads as its own visual block (icon badge, boxed
 * procedures, bigger step numbers) so a long page of text still scans fast
 * instead of blurring into one continuous wall.
 */
export function HelpView() {
  return (
    <div className="space-y-6">
      <nav aria-label="สารบัญ" className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          <ListOrdered className="size-3.5" /> สารบัญ
        </p>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary hover:text-secondary-foreground"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="size-4" />
                </span>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map((section, i) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <section.icon className="size-5.5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                {i + 1}. {section.title}
              </h2>
              <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                {section.roleLabel}
              </span>
              {section.intro && <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>}
            </div>
          </div>

          <div className="space-y-5">
            {section.procedures?.map((proc) => (
              <div key={proc.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-foreground">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-primary" />
                  {proc.title}
                </h3>
                <ol className="space-y-3.5">
                  {proc.steps.map((step, si) => (
                    <li
                      key={si}
                      className={
                        step.illustration
                          ? "grid grid-cols-1 gap-3 sm:grid-cols-[1fr_260px] sm:items-start"
                          : "flex gap-3"
                      }
                    >
                      <div className="flex gap-3 text-sm">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground shadow-sm">
                          {si + 1}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="font-medium text-foreground">{step.text}</p>
                          {step.sub && (
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-muted-foreground marker:text-primary/50">
                              {step.sub.map((s, ssi) => (
                                <li key={ssi}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {step.illustration && (
                        <div className="pl-10 sm:pl-0">
                          <EvalStepIllustration kind={step.illustration} />
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            {section.tables?.map((table) => (
              <div key={table.caption} className="space-y-2">
                <p className="text-sm font-bold text-foreground">{table.caption}</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr>
                        {table.headers.map((h) => (
                          <th key={h} className="px-3 py-2.5 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {table.rows.map((row, ri) => (
                        <tr key={ri} className="odd:bg-card even:bg-muted/40">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2.5 align-top font-medium text-foreground">
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
              <div className="space-y-2.5 rounded-lg border border-warning/30 bg-warning/10 p-4">
                {section.tips.map((tip, ti) => (
                  <p key={ti} className="flex gap-2.5 text-sm font-medium text-foreground">
                    <Lightbulb className="size-4.5 shrink-0 text-warning" />
                    <span>{tip}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
