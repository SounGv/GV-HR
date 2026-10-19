"use client";

import { Reorder, useDragControls } from "framer-motion";
import { Eye, EyeOff, GripVertical, Star } from "lucide-react";
import type { NavGroup, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { moveId, moveWithinPinBlock, pinnedFirst, toggleId, type MenuPrefs } from "./rules";

interface SidebarEditorProps {
  /** The groups in the order being edited, holding only items this person may see. */
  groups: NavGroup[];
  draft: MenuPrefs;
  onChange: (next: MenuPrefs) => void;
  onDone: () => void;
  onCancel: () => void;
  onReset: () => void;
  saving: boolean;
}

const HANDLE_HINT = "ลากเพื่อย้าย หรือกดลูกศรขึ้น/ลงบนแป้นพิมพ์";

/**
 * Lets a mouse press anywhere on a row start the drag, so people can grab the
 * name and not only the small grip. The eye and star buttons keep working as
 * plain clicks. Touch still starts only from the grip, so the list can scroll.
 */
function dragFromRow(controls: ReturnType<typeof useDragControls>) {
  return (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const target = e.target as HTMLElement;
    // The grip starts its own drag; the eye and star are plain buttons.
    if (target.closest("[data-handle]") || target.closest("button")) return;
    controls.start(e);
  };
}

/**
 * The sidebar while the person is arranging it: every group and item can be
 * dragged (or moved with the arrow keys on its handle), hidden with the eye and
 * pinned with the star. Nothing is saved until "เสร็จ".
 */
export function SidebarEditor({ groups, draft, onChange, onDone, onCancel, onReset, saving }: SidebarEditorProps) {
  const groupLabels = groups.map((g) => g.label);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="px-3 pb-2 text-xs text-slate-400">ลากเพื่อเรียงใหม่ · ตา = ซ่อน · ดาว = ขึ้นก่อนในหมวดของตัวเอง</p>

      <Reorder.Group
        axis="y"
        values={groupLabels}
        onReorder={(labels: string[]) => onChange({ ...draft, groupOrder: labels })}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3"
      >
        {groups.map((group) => (
          <EditableGroup
            key={group.label}
            group={group}
            draft={draft}
            onChange={onChange}
            onMoveGroup={(delta) => onChange({ ...draft, groupOrder: moveId(groupLabels, group.label, delta) })}
          />
        ))}
      </Reorder.Group>

      <div className="flex gap-2 border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onReset}
          className="min-h-9 flex-1 rounded-lg border border-slate-600 px-2 text-[13px] font-semibold text-slate-100 transition hover:bg-sidebar-accent"
        >
          คืนค่าเดิม
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 flex-1 rounded-lg border border-slate-600 px-2 text-[13px] font-semibold text-slate-100 transition hover:bg-sidebar-accent"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="min-h-9 flex-1 rounded-lg bg-sidebar-primary px-2 text-[13px] font-bold text-sidebar-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก…" : "เสร็จ"}
        </button>
      </div>
    </div>
  );
}

function EditableGroup({
  group,
  draft,
  onChange,
  onMoveGroup,
}: {
  group: NavGroup;
  draft: MenuPrefs;
  onChange: (next: MenuPrefs) => void;
  onMoveGroup: (delta: -1 | 1) => void;
}) {
  const controls = useDragControls();
  const movable = group.items.filter((i) => !i.isLogout);
  const hrefs = movable.map((i) => i.href);

  return (
    <Reorder.Item value={group.label} dragListener={false} dragControls={controls} className="rounded-xl bg-sidebar select-none">
      <div onPointerDown={dragFromRow(controls)} className="flex h-10 cursor-grab items-center gap-2 rounded-xl px-1.5 text-[14px] font-semibold text-slate-100 active:cursor-grabbing">
        <Handle label={`ย้ายกลุ่ม ${group.label}`} controls={controls} onMove={onMoveGroup} />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px]" style={{ background: group.chipColor }}>
          <group.icon className="size-3.5 text-white" strokeWidth={2.25} />
        </span>
        <span className="flex-grow truncate">{group.label}</span>
      </div>

      <Reorder.Group
        axis="y"
        values={hrefs}
        onReorder={(next: string[]) =>
          onChange({ ...draft, itemOrder: { ...draft.itemOrder, [group.label]: pinnedFirst(next, draft.pinned) } })
        }
        className="mb-1 ml-5 space-y-0.5 border-l-2 border-sidebar-accent pl-2"
      >
        {movable.map((item) => (
          <EditableItem
            key={item.href}
            item={item}
            hidden={draft.hidden.includes(item.href)}
            pinned={draft.pinned.includes(item.href)}
            onToggleHidden={() => onChange({ ...draft, hidden: toggleId(draft.hidden, item.href) })}
            onTogglePinned={() => onChange({ ...draft, pinned: toggleId(draft.pinned, item.href) })}
            onMove={(delta) =>
              onChange({ ...draft, itemOrder: { ...draft.itemOrder, [group.label]: moveWithinPinBlock(hrefs, draft.pinned, item.href, delta) } })
            }
          />
        ))}
      </Reorder.Group>
    </Reorder.Item>
  );
}

function EditableItem({
  item,
  hidden,
  pinned,
  onToggleHidden,
  onTogglePinned,
  onMove,
}: {
  item: NavItem;
  hidden: boolean;
  pinned: boolean;
  onToggleHidden: () => void;
  onTogglePinned: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item.href} dragListener={false} dragControls={controls} className="rounded-lg bg-sidebar select-none">
      <div onPointerDown={dragFromRow(controls)} className="flex h-9 cursor-grab items-center gap-1.5 px-1 text-[13px] text-[#E6E8EA] active:cursor-grabbing">
        <Handle label={`ย้าย ${item.label}`} controls={controls} onMove={onMove} />
        <span className={cn("flex-grow truncate", hidden && "text-slate-500 line-through")}>{item.label}</span>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-pressed={hidden}
          aria-label={hidden ? `แสดง ${item.label}` : `ซ่อน ${item.label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-sidebar-accent hover:text-white"
        >
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onTogglePinned}
          aria-pressed={pinned}
          aria-label={pinned ? `เลิกปักหมุด ${item.label}` : `ปักหมุด ${item.label}`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md transition hover:bg-sidebar-accent",
            pinned ? "text-sidebar-primary" : "text-slate-400 hover:text-white",
          )}
        >
          <Star className="size-4" fill={pinned ? "currentColor" : "none"} />
        </button>
      </div>
    </Reorder.Item>
  );
}

/** The drag handle. Pointer drag starts a drag; ArrowUp / ArrowDown move the row one place for people who do not drag. */
function Handle({
  label,
  controls,
  onMove,
}: {
  label: string;
  controls: ReturnType<typeof useDragControls>;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      data-handle
      aria-label={label}
      title={HANDLE_HINT}
      onPointerDown={(e) => controls.start(e)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          onMove(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
      className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-slate-500 transition hover:bg-sidebar-accent hover:text-white active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
}
