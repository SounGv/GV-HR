"use client";

import { Building2, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import type { DepartmentNode } from "./types";

/** Visual top-down organization chart built from the department hierarchy. */
export function OrgChart({ tree, companyName }: { tree: DepartmentNode[]; companyName?: string }) {
  if (tree.length === 0) {
    return <EmptyState icon={Building2} title="ยังไม่มีโครงสร้างองค์กร" description="เพิ่มฝ่ายและแผนกในแท็บ ฝ่าย / แผนก" />;
  }

  const total = countAll(tree);

  return (
    <div className="space-y-4">
      {/* Company root */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2.5 rounded-2xl bg-sidebar px-5 py-3 text-white shadow-sm">
          <Building2 className="size-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold">{companyName ?? "องค์กร"}</p>
            <p className="text-[11px] text-slate-300">{total} คน · {tree.length} ฝ่าย</p>
          </div>
        </div>
      </div>

      {/* Divisions in a horizontally-scrollable row */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {tree.map((root) => (
            <div key={root.id} className="w-60 shrink-0">
              <NodeCard node={root} accent />
              {root.children.length > 0 && (
                <div className="mt-3 space-y-2 border-l-2 border-dashed border-border pl-3">
                  {root.children.map((child) => (
                    <Branch key={child.id} node={child} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Branch({ node }: { node: DepartmentNode }) {
  return (
    <div>
      <NodeCard node={node} />
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-dashed border-border pl-3">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, accent }: { node: DepartmentNode; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5",
        accent ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
        <p className="text-[11px] text-muted-foreground">{node.code}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Users className="size-3" /> {node.employeeCount}
      </span>
    </div>
  );
}

function countAll(nodes: DepartmentNode[]): number {
  return nodes.reduce((s, n) => s + n.employeeCount + countAll(n.children), 0);
}
