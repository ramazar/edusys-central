import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, StickyNote, FileDown, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { printReport } from "@/lib/print-pdf";

export const Route = createFileRoute("/_authenticated/marks")({ component: MarksPage });

type Student = {
  id: string; full_name: string; student_number: string;
  grade_id: number; section_id: string | null;
  sections: { section_number: number } | null;
};

type Mark = {
  id: string; student_id: string; date: string;
  subject: string; score: number; max_score: number; notes: string | null;
};

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function MarksPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canEdit = hasAny(roles, ["admin", "teacher", "reception"]);

  const [gradeId, setGradeId] = useState<number>(1);
  const [sectionId, setSectionId] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const { data: sections = [] } = useQuery({
    queryKey: ["marks-sections", gradeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, section_number")
        .eq("grade_id", gradeId)
        .eq("is_active", true)
        .order("section_number");
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["marks-students", gradeId, sectionId],
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("id, full_name, student_number, grade_id, section_id, sections(section_number)")
        .eq("grade_id", gradeId)
        .eq("is_active", true)
        .order("full_name");
      if (sectionId !== "all") q = q.eq("section_id", sectionId);
      const { data } = await q;
      return (data ?? []) as Student[];
    },
  });

  const studentIds = students.map((s) => s.id);

  const { data: marks = [] } = useQuery({
    queryKey: ["marks", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_marks")
        .select("id, student_id, date, subject, score, max_score, notes")
        .in("student_id", studentIds)
        .order("date", { ascending: false });
      return (data ?? []) as Mark[];
    },
  });

  const from = weekStart();
  const weeklyMarks = marks.filter((m) => m.date >= from);

  const summary = useMemo(() => {
    const map = new Map<string, { student: Student; total: number; max: number; count: number; subjects: Set<string> }>();
    for (const s of students) map.set(s.id, { student: s, total: 0, max: 0, count: 0, subjects: new Set() });
    for (const m of weeklyMarks) {
      const row = map.get(m.student_id);
      if (!row) continue;
      row.total += Number(m.score);
      row.max += Number(m.max_score);
      row.count += 1;
      row.subjects.add(m.subject);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        pct: r.max > 0 ? (r.total / r.max) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [students, weeklyMarks]);

  const notesRows = weeklyMarks
    .filter((m) => m.notes && m.notes.trim().length > 0)
    .map((m) => {
      const st = students.find((s) => s.id === m.student_id);
      return { ...m, studentName: st?.full_name ?? "-" };
    });

  async function removeMark(m: Mark) {
    if (!confirm("حذف هذه العلامة؟")) return;
    const { error } = await supabase.from("daily_marks").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "daily_marks", m.id, m as unknown, null);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["marks"] });
  }

  function exportWeeklyPDF() {
    const rows = summary.map((r, i) => [
      String(i + 1),
      r.student.full_name,
      r.student.student_number,
      `${r.total.toLocaleString("ar")} / ${r.max.toLocaleString("ar")}`,
      `${r.pct.toFixed(1)}%`,
      String(r.count),
      Array.from(r.subjects).join("، ") || "-",
    ]);
    printReport({
      title: "الملخص الأسبوعي للعلامات",
      subtitle: `الصف ${gradeId} — من ${from} إلى ${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: "#" }, { header: "الطالب" }, { header: "الرقم" },
        { header: "المجموع" }, { header: "النسبة" }, { header: "عدد العلامات" }, { header: "المواد" },
      ],
      rows,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">علامات الطلاب</h1>
          <p className="text-sm text-muted-foreground">إضافة العلامات، الملخص الأسبوعي، وملاحظات الطلاب</p>
        </div>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-1" /> إضافة علامة</Button>
            </DialogTrigger>
            <AddMarkDialog
              students={students}
              onClose={() => setAddOpen(false)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["marks"] })}
            />
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex gap-3 flex-wrap items-end">
          <div>
            <Label>الصف</Label>
            <Select value={String(gradeId)} onValueChange={(v) => { setGradeId(Number(v)); setSectionId("all"); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>الصف {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الشعبة</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشعب</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>شعبة {s.section_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportWeeklyPDF} className="mr-auto">
            <FileDown className="h-4 w-4 ml-1" /> تصدير الملخص PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الملخص الأسبوعي (آخر 7 أيام)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المجموع</TableHead>
                <TableHead>النسبة</TableHead>
                <TableHead>عدد العلامات</TableHead>
                <TableHead>المواد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.filter((r) => r.count > 0).map((r, i) => (
                <TableRow key={r.student.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.student.full_name}</TableCell>
                  <TableCell>{r.total.toLocaleString("ar")} / {r.max.toLocaleString("ar")}</TableCell>
                  <TableCell>
                    <Badge variant={r.pct >= 60 ? "default" : "destructive"}>{r.pct.toFixed(1)}%</Badge>
                  </TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell className="text-xs">{Array.from(r.subjects).join("، ") || "-"}</TableCell>
                </TableRow>
              ))}
              {summary.every((r) => r.count === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">لا توجد علامات مسجلة هذا الأسبوع</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><StickyNote className="h-5 w-5" /> ملاحظات الطلاب (آخر 7 أيام)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المادة</TableHead>
                <TableHead>الملاحظة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notesRows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا توجد ملاحظات</TableCell></TableRow>
              )}
              {notesRows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.date}</TableCell>
                  <TableCell>{n.studentName}</TableCell>
                  <TableCell>{n.subject}</TableCell>
                  <TableCell className="text-sm">{n.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>جميع العلامات</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المادة</TableHead>
                <TableHead>العلامة</TableHead>
                <TableHead>النسبة</TableHead>
                <TableHead>ملاحظة</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {marks.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-6">لا توجد علامات</TableCell></TableRow>
              )}
              {marks.map((m) => {
                const st = students.find((s) => s.id === m.student_id);
                const pct = Number(m.max_score) > 0 ? (Number(m.score) / Number(m.max_score)) * 100 : 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>{st?.full_name ?? "-"}</TableCell>
                    <TableCell>{m.subject}</TableCell>
                    <TableCell>{Number(m.score).toLocaleString("ar")} / {Number(m.max_score).toLocaleString("ar")}</TableCell>
                    <TableCell><Badge variant={pct >= 60 ? "default" : "destructive"}>{pct.toFixed(1)}%</Badge></TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{m.notes ?? "-"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeMark(m)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddMarkDialog({
  students, onClose, onSaved,
}: { students: Student[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [studentId, setStudentId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!studentId || !subject.trim() || !score || !maxScore) {
      return toast.error("يرجى تعبئة الحقول المطلوبة");
    }
    setSaving(true);
    const payload = {
      student_id: studentId,
      subject: subject.trim(),
      score: Number(score),
      max_score: Number(maxScore),
      notes: notes.trim() || null,
      date,
      recorded_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from("daily_marks").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "daily_marks", data?.id, null, payload);
    toast.success("تمت إضافة العلامة");
    onSaved();
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>إضافة علامة</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>الطالب</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="اختر طالباً" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name} — {s.student_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>المادة</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً: الرياضيات" className="text-right" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>العلامة</Label>
            <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>العلامة القصوى</Label>
            <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label>ملاحظة (اختياري)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظة عن الطالب" className="text-right" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} disabled={saving}>حفظ</Button>
      </DialogFooter>
    </DialogContent>
  );
}
