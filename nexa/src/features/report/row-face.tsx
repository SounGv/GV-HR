import { PersonAvatar } from "@/components/shared/person-avatar";

/** The person's own picture in a report's name cell (photo if they have one, else their character), when the row carries it. */
export function RowFace({ row, className }: { row: Record<string, string | number>; className?: string }) {
  if (!row._empId) return null;
  return (
    <PersonAvatar
      name={String(row.name ?? "")}
      gender={String(row._gender ?? "") || null}
      seed={String(row._empId)}
      src={String(row._avatar ?? "") || null}
      className={className ?? "size-7"}
    />
  );
}
