import { faces } from "@/lib/avatar-server";
import { PersonAvatar } from "./person-avatar";

/**
 * A person's own picture, looked up by their employee id on the server (photo address and gender, without reading the photo).
 * For page headers that know who the page is about; lists should use PersonAvatar with the data their query already carries.
 */
export async function PersonFace({ employeeId, name, className }: { employeeId: string; name: string; className?: string }) {
  const face = (await faces([employeeId])).get(employeeId);
  return <PersonAvatar name={name} gender={face?.gender ?? null} seed={employeeId} src={face?.avatarUrl ?? null} className={className ?? "size-8"} />;
}
