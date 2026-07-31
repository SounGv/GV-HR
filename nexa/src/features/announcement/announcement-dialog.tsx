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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useCreateAnnouncement, useUpdateAnnouncement } from "./hooks";
import type { Announcement } from "./types";

const formSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ"),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหา"),
  pinned: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});
type FormSchema = z.infer<typeof formSchema>;

export function AnnouncementDialog({
  open,
  onOpenChange,
  announcement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
}) {
  const isEdit = !!announcement;
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement(announcement?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: announcement?.title ?? "",
      body: announcement?.body ?? "",
      pinned: announcement?.pinned ?? false,
      status: announcement?.status ?? "PUBLISHED",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        await updateMut.mutateAsync(values);
        toast.success("บันทึกประกาศเรียบร้อย");
      } else {
        await createMut.mutateAsync(values);
        toast.success("เผยแพร่ประกาศเรียบร้อย");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขประกาศ" : "สร้างประกาศ"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id="ann-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หัวข้อ</FormLabel>
                  <FormControl>
                    <Input placeholder="หัวข้อประกาศ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เนื้อหา</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="รายละเอียดประกาศ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="status"
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
                        <SelectItem value="PUBLISHED">เผยแพร่</SelectItem>
                        <SelectItem value="DRAFT">ฉบับร่าง</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel>ปักหมุด</FormLabel>
                      <FormDescription>แสดงบนสุด</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="ann-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เผยแพร่"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
