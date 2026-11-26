import { Lightbulb, ListOrdered, MapPin } from "lucide-react";

import { GUIDE_SECTIONS, type GuideStep } from "./guide-content";

/**
 * The HR guide: a table of contents, then every chapter in full. A chapter is a list of tasks; a task is numbered steps and each
 * step can have a picture of the real screen with numbered markers. Flat cards, one blue accent, text never under 12px.
 */
export function HelpView() {
  return (
    <div className="space-y-6">
      <nav aria-label="สารบัญ" className="rounded-lg border border-border bg-card p-5 print:hidden">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground">
          <ListOrdered className="size-3.5" aria-hidden="true" /> สารบัญ
        </p>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary hover:text-secondary-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="size-4" aria-hidden="true" />
                </span>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map((section, i) => (
        <section key={section.id} id={section.id} className="scroll-mt-20 rounded-lg border border-border bg-card p-5 sm:p-6 print:break-before-page">
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <section.icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-[1.4] text-foreground sm:text-2xl">
                {i + 1}. {section.title}
              </h2>
              {section.intro && <p className="mt-1 text-base leading-[1.65] sm:text-sm text-muted-foreground">{section.intro}</p>}
            </div>
          </div>

          <div className="space-y-5">
            {section.procedures?.map((proc) => (
              <div key={proc.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="flex items-center gap-2 text-lg font-bold leading-[1.4] text-foreground sm:text-xl">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {proc.title}
                </h3>
                {proc.where && (
                  <p className="mt-1.5 mb-3 flex items-center gap-1.5 text-sm leading-[1.65] text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" /> {proc.where}
                  </p>
                )}
                <ol className="mt-3 space-y-5">
                  {proc.steps.map((step, si) => (
                    <Step key={si} n={si + 1} step={step} />
                  ))}
                </ol>
              </div>
            ))}

            {section.tables?.map((table) => (
              <div key={table.caption} className="space-y-2">
                <p className="text-base leading-[1.65] sm:text-sm font-bold text-foreground">{table.caption}</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[480px] text-left text-base leading-[1.65] sm:text-sm">
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
                  <p key={ti} className="flex gap-2.5 text-base leading-[1.65] sm:text-sm font-medium text-foreground">
                    <Lightbulb className="size-4 shrink-0 text-warning" aria-hidden="true" />
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

function Step({ n, step }: { n: number; step: GuideStep }) {
  return (
    <li className="flex gap-3 text-base leading-[1.65] sm:text-sm print:break-inside-avoid">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <p className="font-medium text-foreground">{step.text}</p>
        {step.sub && (
          <ul className="list-disc space-y-1 pl-4 text-sm leading-[1.65] text-muted-foreground marker:text-primary/50">
            {step.sub.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
        {step.image && (
          <figure className="overflow-hidden rounded-lg border border-border bg-card">
            <a href={step.image.src} target="_blank" rel="noopener" aria-label={`เปิดรูปเต็มขนาด: ${step.image.alt}`} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- a fixed screenshot from public/help; no resizing needed */}
              <img src={step.image.src} alt={step.image.alt} loading="lazy" className="h-auto w-full" />
            </a>
            <figcaption className="border-t border-border bg-muted/40 px-3 py-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-bold text-foreground">ตัวเลขในรูปหมายถึง</p>
                <p className="text-sm text-muted-foreground print:hidden">แตะรูปเพื่อขยาย</p>
              </div>
              <ol className="space-y-2">
                {step.image.legend.map(([label, text], i) => (
                  <li key={i} className="flex gap-2.5 text-base leading-[1.65] sm:text-sm">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-foreground">
                      <span className="font-bold">{label}</span>
                      <span className="text-muted-foreground"> {text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </figcaption>
          </figure>
        )}
      </div>
    </li>
  );
}
