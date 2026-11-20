"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileAttachField } from "@/components/shared/file-attach-field";
import { AttachmentLink } from "@/components/shared/attachment-link";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAddEmployeeDocument, useEmployeeDocuments, useRemoveEmployeeDocument } from "./hooks";
import { EMPLOYEE_DOCUMENT_TYPE_LABEL } from "./labels";
import type { EmployeeDocumentType } from "./types";

export function EmployeeDocumentList({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data, isLoading } = useEmployeeDocuments(employeeId);
  const addMutation = useAddEmployeeDocument(employeeId);
  const removeMutation = useRemoveEmployeeDocument(employeeId);
  const documents = data?.data ?? [];

  const [type, setType] = useState<EmployeeDocumentType>("ID_CARD");
  const [label, setLabel] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  async function add() {
    if (!fileUrl) {
      toast.error("กรุณาแนบไฟล์");
      return;
    }
    try {
      await addMutation.mutateAsync({ type, label: label.trim() || EMPLOYEE_DOCUMENT_TYPE_LABEL[type], fileUrl });
      toast.success("แนบเอกสารเรียบร้อย");
      setLabel("");
      setFileUrl("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "แนบเอกสารไม่สำเร็จ");
    }
  }

  async function remove(id: string) {
    try {
      await removeMutation.mutateAsync(id);
      toast.success("ลบเอกสารแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">เอกสารพนักงาน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีเอกสารที่แนบไว้</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">No.</TableHead>
                <TableHead className="w-full">ชื่อเอกสาร</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>วันที่แนบ</TableHead>
                {canEdit && <TableHead className="text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc, i) => (
                <TableRow key={doc.id}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell className="whitespace-normal">
                    <AttachmentLink url={doc.fileUrl} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium hover:text-primary hover:underline">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="break-words">{doc.label}</span>
                    </AttachmentLink>
                  </TableCell>
                  <TableCell>{EMPLOYEE_DOCUMENT_TYPE_LABEL[doc.type]}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(doc.uploadedAt)}</TableCell>
                  {canEdit && (
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive"
                        onClick={() => remove(doc.id)}
                        disabled={removeMutation.isPending}
                        aria-label={`ลบเอกสาร ${doc.label}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canEdit && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={type} onValueChange={(v) => setType((v as EmployeeDocumentType) ?? "ID_CARD")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMPLOYEE_DOCUMENT_TYPE_LABEL) as EmployeeDocumentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {EMPLOYEE_DOCUMENT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 text-sm"
                placeholder="ชื่อเอกสาร (ไม่บังคับ)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <FileAttachField value={fileUrl || undefined} onChange={setFileUrl} label="เลือกไฟล์" />
              <Button type="button" size="sm" onClick={add} disabled={addMutation.isPending}>
                แนบเอกสาร
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
