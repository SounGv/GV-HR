"use client";

import { useState } from "react";
import { Plus, ClipboardCheck } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";

import { ReviewCard } from "./review-card";
import { ReviewDialog } from "./review-dialog";
import { useReviews } from "./hooks";
import type { PerformanceReview } from "./types";

export function PerformanceView() {
  const { can } = useAuth();
  const canReview = can("performance:create");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ผลประเมินของฉัน</TabsTrigger>
        {canReview && <TabsTrigger value="team">ประเมินทีม</TabsTrigger>}
      </TabsList>

      <TabsContent value="me">
        <MyReviews />
      </TabsContent>

      {canReview && (
        <TabsContent value="team">
          <TeamReviews />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyReviews() {
  const { data, isLoading, isError, refetch } = useReviews("me");
  const reviews = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  if (reviews.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="ยังไม่มีผลการประเมิน" description="ผลการประเมินจากหัวหน้างานจะแสดงที่นี่" />;
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  );
}

function TeamReviews() {
  const { data, isLoading, isError, refetch } = useReviews("team");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceReview | null>(null);
  const reviews = data?.data ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(r: PerformanceReview) {
    setEditing(r);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ผลประเมินของทีม</h2>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> สร้างการประเมิน
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="ยังไม่มีการประเมิน" description="เริ่มต้นด้วยการประเมินสมาชิกในทีม" />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} showEmployee onEdit={openEdit} />
          ))}
        </div>
      )}

      <ReviewDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        review={editing}
      />
    </div>
  );
}
