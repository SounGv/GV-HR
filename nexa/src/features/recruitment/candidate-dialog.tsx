"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { CANDIDATE_STAGES } from "./schema";
import { CANDIDATE_STAGE_LABEL } from "./labels";
import { useCreateCandidate, useJobs } from "./hooks";

const formSchema = z.object({
  jobPostingId: z.string().uuid("กรุณาเลือกตำแหน่ง"),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  email: z.union([z.string().email("อีเมลไม่ถูกต้อง"), z.literal("")]).optional(),
  phone: z.string().optional(),
  stage: z.enum(CANDIDATE_STAGES),
  note: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function CandidateDialog({
  open,
  onOpenChange,
  defaultJobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
}) {
  const { data: jobsData } = useJobs();
  const createMut = useCreateCandidate();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobPostingId: defaultJobId ?? "",
      name: "",
      email: "",
      phone: "",
      stage: "APPLIED",
      note: "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values);
      toast.success("เพิ่มผู้สมัครเรียบร้อย");
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มผู้สมัคร</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="cand-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="jobPostingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ตำแหน่งที่สมัคร</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="เลือกตำแหน่ง" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(jobsData?.data ?? []).map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อผู้สมัคร</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เบอร์โทร</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานะ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CANDIDATE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CANDIDATE_STAGE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมายเหตุ</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="cand-form" disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="size-4 animate-spin" />}
            เพิ่ม
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
