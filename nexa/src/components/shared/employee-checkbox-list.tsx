interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

/** Scrollable multi-select checkbox list for picking several employees at
 * once — shared by every bulk add/invite dialog (participants, raters, ...)
 * so the selection UI can't drift out of sync between them. */
export function EmployeeCheckboxList({
  candidates,
  selected,
  onToggle,
  emptyText = "ไม่มีพนักงานให้เลือก",
  className = "max-h-72",
}: {
  candidates: EmployeeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyText?: string;
  className?: string;
}) {
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className={`${className} space-y-1 overflow-y-auto`}>
      {candidates.map((c) => (
        <label key={c.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => onToggle(c.id)}
            className="size-4 accent-primary"
          />
          <span className="min-w-0 flex-1 truncate">
            {c.firstName} {c.lastName} ({c.employeeCode})
          </span>
        </label>
      ))}
    </div>
  );
}
