/** Evaluation pages: the group's tabs (including HR's list pages) are in the band at the top of the screen (components/layout/section-band.tsx). */
export default function AppraisalLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
