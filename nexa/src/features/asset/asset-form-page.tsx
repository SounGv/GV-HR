"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
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

const FORM_ID = "asset-form";
const LIST = "/assets";

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

export function AssetFormPage({ asset }: { asset?: Asset }) {
  const router = useRouter();
  const isEdit = !!asset;
  const createMut = useCreateAsset();
  const updateMut = useUpdateAsset(asset?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

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
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values);
        toast.success("เพิ่มทรัพย์สินเรียบร้อย");
        if (againRef.current) {
          form.reset();
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push(LIST);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    ...(isEdit ? [] : [{ label: "บันทึกและเพิ่มใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "เพิ่มทรัพย์สิน", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "เอกสารและทรัพย์สิน", href: LIST }, { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขทรัพย์สิน" : "เพิ่มทรัพย์สิน"}
      description="ทะเบียนทรัพย์สินขององค์กร"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-2xl grid-cols-2 gap-3">
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
    </FormPageShell>
  );
}
