import { redirect } from "next/navigation";

/** Old single-review form, replaced by the evaluation rounds (it had collected only 2 test records). */
export default function Page() {
  redirect("/appraisal/rounds");
}
