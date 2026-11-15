import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "./states";

/**
 * Shown in place of a request's page when the signed-in person is not allowed to see it (someone else's leave, OT
 * or time correction, usually reached from an old link or a notification). It says so in plain words and gives the
 * way back, instead of the generic error page that made it look like the system had broken.
 *
 * @param what The kind of request, e.g. "คำขอลา".
 * @param listHref Where the person's own list of these requests is.
 * @param listLabel The button text, e.g. "กลับไปประวัติการลา".
 */
export function NoAccessRequest({ what, listHref, listLabel }: { what: string; listHref: string; listLabel: string }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title={`คุณไม่มีสิทธิ์ดู${what}นี้`}
      description={`${what}นี้เป็นของคนอื่น คุณดูได้เฉพาะรายการของตัวเองและของลูกทีม ถ้าควรเห็นรายการนี้ แจ้ง HR`}
      action={
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-accent"
        >
          {listLabel}
        </Link>
      }
      className="mx-auto mt-6 max-w-xl"
    />
  );
}
