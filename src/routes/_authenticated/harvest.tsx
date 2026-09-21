import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Sprout, Trash2 } from "lucide-react";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { ExportMenu } from "@/components/ExportMenu";
import { sectionLabel } from "@/lib/section-label";

export const Route = createFileRoute("/_authenticated/harvest")({
  component: HarvestPage,
});

type Grade = { id: number; name_ar: string };
type Section = { id: string; grade_id: number; section_number: number; gender: string | null };
type Harvest = {
  id: string;
  grade_id: number;
  section_id: string;
  subject: string;
  content: string;
  page: string | null;
  homework: string | null;
  date: string;
  created_at: string;
};

function HarvestPage() {
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canEdit = hasAny(roles, ["admin", "teacher", "reception"]);
  const canDelete = hasAny(roles, ["admin"]);
  const qc = useQueryClient();

  const [gradeId, setGradeId] = useState<number>(1);
  const [sectionId, setSectionId] = useState<string>("");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [exportRange, setExportRange] = useState<"filters" | "day">("filters");

  const { data: grades = [] } = useQuery({
    queryKey: ["harvest-grades"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("id, name_ar")
        .eq("is_active", true)
        .order("id");
      return (data ?? []) as Grade[];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["harvest-sections", gradeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, grade_id, section_number, gender")
        .eq("grade_id", gradeId)
        .eq("is_active", true)
        .order("section_number");
      return (data ?? []) as Section[];
    },
  });

  useEffect(() => {
    setSectionId((prev) => (sections.find((s) => s.id === prev) ? prev : sections[0]?.id ?? ""));
  }, [sections]);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["harvest-rows", gradeId, sectionId, from, to],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_harvest")
        .select("*")
        .eq("section_id", sectionId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Harvest[];
    },
  });

  const gradeName = useMemo(
    () => grades.find((g) => g.id === gradeId)?.name_ar ?? "",
    [grades, gradeId],
  );
  const sectionNum = useMemo(
    () => sections.find((s) => s.id === sectionId)?.section_number ?? "",
    [sections, sectionId],
  );

  const removeRow = async (row: Harvest) => {
    if (!confirm("حذف هذا السجل؟")) return;
    const { error } = await supabase.from("academic_harvest").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit(user, "delete", "academic_harvest", row.id, row, null);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["harvest-rows"] });
  };

  const buildDoc = () => {
    const today = new Date().toISOString().slice(0, 10);
    const exportRows =
      exportRange === "day" ? rows.filter((r) => r.date === today) : rows;
    if (exportRows.length === 0) return null;
    const meta =
      exportRange === "day"
        ? [
            { label: "التاريخ", value: today },
            { label: "عدد السجلات", value: String(exportRows.length) },
          ]
        : [
            { label: "من", value: from },
            { label: "إلى", value: to },
            { label: "عدد السجلات", value: String(exportRows.length) },
          ];
    return {
      title: "الحصاد العلمي",
      subtitle: `${gradeName} — الشعبة ${sectionNum}`,
      meta,
      tables: [
        {
          columns: ["التاريخ", "المادة", "الصفحة", "ما تم تعلمه", "الواجب"],
          rows: exportRows.map((r) => [
            r.date,
            r.subject,
            (r as any).page ?? "-",
            r.content,
            (r as any).homework ?? "-",
          ]),
          rowLines: (r: (string | number)[]) => {
            const [ , subject, page, content, homework ] = r.map((v) => String(v ?? "").trim());
            const lines: string[] = [];
            const pageBit = page && page !== "-" ? ` (صفحة ${page})` : "";
            lines.push(`• *${subject}*${pageBit}`);
            content
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .forEach((l) => lines.push(l));
            if (homework && homework !== "-") {
              homework
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .forEach((l, idx) => lines.push(idx === 0 ? `الواجب: ${l}` : l));
            }
            lines.push("");
            return lines;
          },
        },
      ],
      filename:
        exportRange === "day" ? `harvest-${today}` : `harvest-${from}-${to}`,
    };
  };


  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الحصاد العلمي</h1>
            <p className="text-sm text-muted-foreground">
              سجّل يوميًا ما تعلّمه كل صف وشعبة في كل مادة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            sectionId={sectionId}
            doc={buildDoc}
            pdfColumns={[
              { header: "التاريخ", width: "14%" },
              { header: "المادة", width: "16%" },
              { header: "الصفحة", width: "10%" },
              { header: "ما تم تعلمه", width: "38%" },
              { header: "الواجب", width: "22%" },
            ]}
          />

          {canEdit && sectionId && (
            <AddHarvestDialog
              gradeId={gradeId}
              sectionId={sectionId}
              onSaved={() => refetch()}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>الصف</Label>
              <Select value={String(gradeId)} onValueChange={(v) => setGradeId(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الشعبة</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر شعبة" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {sectionLabel(s.section_number, s.gender)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            السجلات ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد سجلات في هذه الفترة.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {r.subject}
                      </span>
                      {r.page && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          صفحة {r.page}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {r.date}
                      </span>
                    </div>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {r.content}
                  </p>
                  {r.homework && (
                    <div className="mt-3 rounded-md border border-dashed p-3">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        الواجب
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {r.homework}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddHarvestDialog({
  gradeId,
  sectionId,
  onSaved,
}: {
  gradeId: number;
  sectionId: string;
  onSaved: () => void;
}) {
  const { user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [page, setPage] = useState("");
  const [homework, setHomework] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error("املأ المادة والمحتوى");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("academic_harvest")
      .insert({
        grade_id: gradeId,
        section_id: sectionId,
        subject: subject.trim(),
        content: content.trim(),
        page: page.trim() || null,
        homework: homework.trim() || null,
        date,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit(user, "create", "academic_harvest", data?.id, null, data);
    toast.success("تم الحفظ");
    setSubject("");
    setContent("");
    setPage("");
    setHomework("");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ms-2 h-4 w-4" />
          إضافة سجل
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة حصاد علمي</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المادة</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: الرياضيات"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الصفحة</Label>
            <Input
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="مثال: 42 أو 42-45"
            />
          </div>
          <div className="space-y-1.5">
            <Label>ما تم تعلمه</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="اكتب ملخصًا لما تم تدريسه اليوم..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>الواجب</Label>
            <Textarea
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              rows={3}
              placeholder="مثال: حل تمارين صفحة 43"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
