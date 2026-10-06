import { redirect } from "next/navigation";

/** The evaluation home is the rounds list. */
export default function AppraisalHomePage() {
  redirect("/appraisal/rounds");
}
