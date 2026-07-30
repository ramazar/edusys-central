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
import { BookCheck, Check, CircleSlash, CircleDot, Plus, Trash2 } from "lucide-react";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { ExportMenu } from "@/components/ExportMenu";

export const Route = createFileRoute("/_authenticated/homework")({
  component: HomeworkPage,
});

type Section = { id: string; grade_id: number; section_number: number };
type Assignment = {
  id: string;
  grade_id: number;
  section_id: string;
  subject: string;
  title: string;
  date: string;
  notes: string | null;
  created_at: string;
};
type Status = "done" | "not_done" | "partial";
type Student = { id: string; full_name: string; student_number: string };
type HWRecord = { assignment_id: string; student_id: string; status: Status; notes: string | null };

const statusLabel = (s: Status) =>
  s === "done" ? "أنجز" : s === "partial" ? "جزئي" : "لم يُنجز";

function HomeworkPage() {
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canEdit = hasAny(roles, ["admin", "teacher", "reception"]);
  const canDelete = hasAny(roles, ["admin"]);
  const qc = useQueryClient();

  const [gradeId, setGradeId] = useState<number>(1);
  const [sectionId, setSectionId] = useState<string>("");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openAssignment, setOpenAssignment] = useState<Assignment | null>(null);

  const { data: sections = [] } = useQuery({
    queryKey: ["hw-sections", gradeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, grade_id, section_number")
        .eq("grade_id", gradeId)
        .eq("is_active", true)
        .order("section_number");
      return (data ?? []) as Section[];
    },
  });

  useEffect(() => {
    setSectionId((prev) => (sections.find((s) => s.id === prev) ? prev : sections[0]?.id ?? ""));
  }, [sections]);

  const { data: assignments = [], refetch } = useQuery({
    queryKey: ["hw-assignments", sectionId, from, to],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework_assignments")
        .select("*")
        .eq("section_id", sectionId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const sectionNum = useMemo(
    () => sections.find((s) => s.id === sectionId)?.section_number ?? "",
    [sections, sectionId],
  );

  const removeAssignment = async (a: Assignment) => {
    if (!confirm("حذف هذا الواجب وسجلاته؟")) return;
    const { error } = await supabase.from("homework_assignments").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "homework_assignments", a.id, a, null);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["hw-assignments"] });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الواجبات</h1>
            <p className="text-sm text-muted-foreground">
              سجّل الواجبات في الأيام التي فيها واجب فقط، وحدّد حالة كل طالب
            </p>
          </div>
        </div>
        {canEdit && sectionId && (
          <AddAssignmentDialog
            gradeId={gradeId}
            sectionId={sectionId}
            onSaved={() => refetch()}
          />
        )}
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                    <SelectItem key={g} value={String(g)}>{`الصف ${g}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الشعبة</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder="اختر شعبة" /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>شعبة {s.section_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>من تاريخ</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الواجبات ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد واجبات في هذه الفترة.
            </p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {a.subject}
                      </span>
                      <span className="text-xs text-muted-foreground" dir="ltr">{a.date}</span>
                    </div>
                    <div className="font-medium">{a.title}</div>
                    {a.notes && (
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.notes}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setOpenAssignment(a)}>
                      متابعة الطلاب
                    </Button>
                    {canDelete && (
                      <Button size="sm" variant="ghost" onClick={() => removeAssignment(a)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {openAssignment && (
        <AssignmentDialog
          assignment={openAssignment}
          sectionNumber={sectionNum as number}
          canEdit={canEdit}
          onClose={() => setOpenAssignment(null)}
        />
      )}
    </div>
  );
}

function AddAssignmentDialog({
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
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !title.trim()) {
      toast.error("املأ المادة وعنوان الواجب");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("homework_assignments")
      .insert({
        grade_id: gradeId,
        section_id: sectionId,
        subject: subject.trim(),
        title: title.trim(),
        notes: notes.trim() || null,
        date,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "homework_assignments", data?.id, null, data);
    toast.success("تم إضافة الواجب");
    setSubject("");
    setTitle("");
    setNotes("");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ms-2 h-4 w-4" />
          إضافة واجب
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة واجب جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>المادة</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: الرياضيات" />
          </div>
          <div className="space-y-1.5">
            <Label>عنوان الواجب</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تمارين الصفحة 42" />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({
  assignment,
  sectionNumber,
  canEdit,
  onClose,
}: {
  assignment: Assignment;
  sectionNumber: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthSession();
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({} as any);
  const [saving, setSaving] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["hw-students", assignment.section_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, student_number")
        .eq("section_id", assignment.section_id)
        .eq("is_active", true)
        .order("full_name");
      return (data ?? []) as Student[];
    },
  });

  const { data: records } = useQuery({
    queryKey: ["hw-records", assignment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("homework_records")
        .select("assignment_id, student_id, status, notes")
        .eq("assignment_id", assignment.id);
      return (data ?? []) as HWRecord[];
    },
  });

  useEffect(() => {
    if (!students || !records) return;
    const m: Record<string, Status> = {} as any;
    list.forEach((s) => (m[s.id] = "not_done"));
    records.forEach((r) => (m[r.student_id] = r.status));
    setStatusMap(m);
  }, [students, records]);

  const list: Student[] = students ?? [];




  const save = async () => {
    if (list.length === 0) return;
    setSaving(true);
    const rows = list.map((s) => ({
      assignment_id: assignment.id,
      student_id: s.id,
      status: (statusMap[s.id] || "not_done") as Status,
      recorded_by: user?.id ?? null,
    }));
    const { error } = await supabase
      .from("homework_records")
      .upsert(rows, { onConflict: "assignment_id,student_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user, "bulk_upsert", "homework_records", assignment.id, null, { count: rows.length });
    toast.success(`تم حفظ حالة ${rows.length} طالب`);
  };

  const buildDoc = () => {
    if (list.length === 0) {
      toast.error("لا يوجد طلاب");
      return null;
    }
    const counts = { done: 0, partial: 0, not_done: 0 } as Record<Status, number>;
    const rows = list.map((s, i) => {
      const st = (statusMap[s.id] || "not_done") as Status;
      counts[st]++;
      return [i + 1, s.full_name, s.student_number, statusLabel(st)];
    });
    return {
      title: `الواجب — ${assignment.subject}`,
      subtitle: `${assignment.title} — الصف ${assignment.grade_id} / الشعبة ${sectionNumber}`,
      meta: [
        { label: "التاريخ", value: assignment.date },
        { label: "المادة", value: assignment.subject },
        { label: "العنوان", value: assignment.title },
        { label: "إجمالي الطلاب", value: String(list.length) },
        { label: "أنجز", value: String(counts.done) },
        { label: "جزئي", value: String(counts.partial) },
        { label: "لم يُنجز", value: String(counts.not_done) },
      ],
      tables: [{ columns: ["#", "اسم الطالب", "رقم الطالب", "الحالة"], rows }],
      filename: `homework-${assignment.date}`,
    };
  };

  const setAll = (s: Status) => {
    const m: Record<string, Status> = {} as any;
    list.forEach((x) => (m[x.id] = s));
    setStatusMap(m);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {assignment.subject} — {assignment.title}
            <span className="text-xs text-muted-foreground ms-2" dir="ltr">{assignment.date}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          <Button size="sm" variant="outline" onClick={() => setAll("done")} disabled={!canEdit}>
            <Check className="ms-1 h-4 w-4" /> الكل أنجز
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("not_done")} disabled={!canEdit}>
            <CircleSlash className="ms-1 h-4 w-4" /> الكل لم يُنجز
          </Button>
          <div className="ms-auto flex gap-2">
            <ExportMenu
              size="sm"
              doc={buildDoc}
              pdfColumns={[
                { header: "#", width: "8%", align: "center" },
                { header: "اسم الطالب", width: "50%" },
                { header: "رقم الطالب", width: "22%" },
                { header: "الحالة", width: "20%", align: "center" },
              ]}
            />
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "..." : "حفظ الكل"}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto space-y-2 pt-2">
          {list.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">لا يوجد طلاب في هذه الشعبة</div>
          )}
          {list.map((s) => {
            const st = (statusMap[s.id] || "not_done") as Status;
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 hover:bg-muted/40">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">{s.student_number}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={st === "done" ? "default" : "outline"}
                    className={st === "done" ? "bg-success hover:bg-success/90" : ""}
                    onClick={() => canEdit && setStatusMap({ ...statusMap, [s.id]: "done" })}
                    disabled={!canEdit}
                  >
                    <Check className="ms-1 h-4 w-4" /> أنجز
                  </Button>
                  <Button
                    size="sm"
                    variant={st === "partial" ? "default" : "outline"}
                    className={st === "partial" ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}
                    onClick={() => canEdit && setStatusMap({ ...statusMap, [s.id]: "partial" })}
                    disabled={!canEdit}
                  >
                    <CircleDot className="ms-1 h-4 w-4" /> جزئي
                  </Button>
                  <Button
                    size="sm"
                    variant={st === "not_done" ? "destructive" : "outline"}
                    onClick={() => canEdit && setStatusMap({ ...statusMap, [s.id]: "not_done" })}
                    disabled={!canEdit}
                  >
                    <CircleSlash className="ms-1 h-4 w-4" /> لم يُنجز
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
