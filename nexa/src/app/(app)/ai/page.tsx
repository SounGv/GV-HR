import type { Metadata } from "next";
import { requireAiPageAccess } from "@/lib/auth/page-guard";
import { AiChatView } from "@/features/ai/ai-chat-view";
import { AiWorkspace } from "@/features/ai/ai-workspace";

export const metadata: Metadata = { title: "AI Assistant" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AiPage({ searchParams }: Props) {
  await requireAiPageAccess();
  // `/ai?q=` comes from the dashboard's ask box; it's asked once on arrival.
  const { q } = await searchParams;
  const initialQuestion = typeof q === "string" ? q.trim().slice(0, 2000) || undefined : undefined;

  return (
    <>
      {/* Desktop: chat on the left, the answer's tables and numbers on a wide panel on the right. */}
      <div className="hidden md:block">
        <AiWorkspace initialQuestion={initialQuestion} />
      </div>
      {/* Phone: one column; tables scroll inside their own box. */}
      <div className="md:hidden">
        <AiChatView initialQuestion={initialQuestion} />
      </div>
    </>
  );
}
