import { redirect } from "next/navigation";

/**
 * The AI evaluation designer now lives as a tab inside ประเมินผลงาน
 * (/performance). This route is kept only to redirect old links.
 */
export default function AiEvaluationPage() {
  redirect("/performance");
}
