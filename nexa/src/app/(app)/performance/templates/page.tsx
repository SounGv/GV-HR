import { redirect } from "next/navigation";

/** Old screen, replaced by the new evaluation menu. */
export default function Page() {
  redirect("/appraisal/forms");
}
