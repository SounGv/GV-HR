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
import { ASSET_STATUSES } from "./schema";
import { ASSET_STATUS_LABEL } from "./labels";
import { useCreateAsset, useUpdateAsset } from "./hooks";
import type { Asset } from "./types";

const formSchema = z.object({
  assetCode: z.string().trim().min(1, "กรุณาระบุรหัส"),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  category: z.string().trim().min(1, "กรุณาระบุหมวดหมู่"),
  serialNumber: z.string().optional(),
  status: z.enum(ASSET_STATUSES),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  note: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
}) {
  const isEdit = !!asset;
  const createMut = useCreateAsset();
  const updateMut = useUpdateAsset(asset?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetCode: asset?.assetCode ?? "",
      name: asset?.name ?? "",
      category: asset?.category ?? "",
      serialNumber: asset?.serialNumber ?? "",
      status: asset?.status ?? "AVAILABLE",
      purchaseDate: asset?.purchaseDate ? asset.purchaseDate.slice(0, 10) : "",
      purchasePrice: asset?.purchasePrice != null ? String(asset.purchasePrice) : "",
      note: asset?.note ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        await updateMut.mutateAsync(values);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else {
        await createMut.mutateAsync(values);
        toast.success("เพิ่มทรัพย์สินเรียบร้อย");
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
          <DialogTitle>{isEdit ? "แก้ไขทรัพย์สิน" : "เพิ่มทรัพย์สิน"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id="asset-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="assetCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสทรัพย์สิน</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น IT-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมวดหมู่</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น โน้ตบุ๊ก" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>ชื่อทรัพย์สิน</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น MacBook Pro 14”" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
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
                      {ASSET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ASSET_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่ซื้อ</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ราคาซื้อ (บาท)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="col-span-2">
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button type="submit" form="asset-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "เพิ่ม"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
