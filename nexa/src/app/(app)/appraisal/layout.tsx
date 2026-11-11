import { AppraisalManageTabs } from "@/features/appraisal-round/manage-tabs";

/** Evaluation pages: HR's list pages share one tab row (the sidebar has a single "จัดการประเมิน" entry). */
export default function AppraisalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <AppraisalManageTabs />
      {children}
    </div>
  );
}
