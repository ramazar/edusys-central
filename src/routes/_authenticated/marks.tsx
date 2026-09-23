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
import { Trash2, Plus, StickyNote, MessageSquarePlus, Users, Pencil } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { BulkMarksDialog } from "@/components/marks/BulkMarksDialog";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { sectionLabel } from "@/lib/section-label";


export const Route = createFileRoute("/_authenticated/marks")({ component: MarksPage });

type Student = {
  id: string; full_name: string; student_number: string;
  grade_id: number; section_id: string | null;
  sections: { section_number: number; gender: string | null } | null;
};

type MarkType = "teacher_recitation" | "academic_supervision";
type Mark = {
  id: string; student_id: string; date: string;
  subject: string; score: number; max_score: number; notes: string | null;
  mark_type: MarkType | null;
};

export const markTypeLabels: Record<MarkType, string> = {
  teacher_recitation: "تسميع مدرس",
  academic_supervision: "إشراف علمي",
};
const markTypeLabel = (t: MarkType | null) => (t ? markTypeLabels[t] : "غير مصنّف");

function MarkTypeSelect({ value, onChange, allowNone }: {
  value: MarkType | "none"; onChange: (v: MarkType | "none") => void; allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MarkType | "none")}>
      <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="teacher_recitation">تسميع مدرس</SelectItem>
        <SelectItem value="academic_supervision">إشراف علمي</SelectItem>
        {allowNone && <SelectItem value="none">غير مصنّف</SelectItem>}
      </SelectContent>
    </Select>
  );
}

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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportRange, setExportRange] = useState<"day" | "week">("week");
  const [exportType, setExportType] = useState<"all" | MarkType>("all");
  const [editMark, setEditMark] = useState<Mark | null>(null);

  const { data: sections = [] } = useQuery({
    queryKey: ["marks-sections", gradeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, section_number, gender")
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
        .select("id, full_name, student_number, grade_id, section_id, sections(section_number, gender)")
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
        .select("id, student_id, date, subject, score, max_score, notes, mark_type")
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
      if (Number(m.max_score) <= 0) continue;
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

  const today = new Date().toISOString().slice(0, 10);
  const rangeFrom = exportRange === "day" ? today : from;
  const rangeLabel = exportRange === "day" ? `اليوم ${today}` : `هذا الأسبوع (من ${from})`;
  const typeLabel = exportType === "all" ? "كل الأنواع" : markTypeLabels[exportType];
  const typeOk = (m: Mark) => exportType === "all" || m.mark_type === exportType;

  function exportData() {
    const inRange = marks.filter((m) => m.date >= rangeFrom && typeOk(m));
    const allComments = inRange
      .filter((m) => m.notes && m.notes.trim().length > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const allMarks = inRange
      .filter((m) => Number(m.max_score) > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const map = new Map<string, { name: string; total: number; max: number; count: number; subjects: Set<string> }>();
    for (const m of allMarks) {
      const st = students.find((s) => s.id === m.student_id);
      if (!st) continue;
      const r = map.get(st.id) ?? { name: st.full_name, total: 0, max: 0, count: 0, subjects: new Set<string>() };
      r.total += Number(m.score); r.max += Number(m.max_score); r.count += 1; r.subjects.add(m.subject);
      map.set(st.id, r);
    }
    const expSummary = Array.from(map.values())
      .map((r) => ({ ...r, pct: r.max > 0 ? (r.total / r.max) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    // Group marks by type (when exporting all types, each type gets its own section).
    const groups: { heading: string; items: Mark[] }[] =
      exportType !== "all"
        ? [{ heading: `العلامات — ${markTypeLabels[exportType]}`, items: allMarks }]
        : ([
            ["teacher_recitation", "العلامات — تسميع مدرس"],
            ["academic_supervision", "العلامات — إشراف علمي"],
            [null, "العلامات — غير مصنّفة"],
          ] as [MarkType | null, string][])
            .map(([t, h]) => ({ heading: h, items: allMarks.filter((m) => (m.mark_type ?? null) === t) }))
            .filter((g, i) => i < 2 || g.items.length > 0);
    return { allComments, allMarks, expSummary, groups };
  }

  function buildWeeklyDoc() {
    const nameOf = (id: string) => students.find((st) => st.id === id)?.full_name ?? "-";
    const { allComments, allMarks, expSummary, groups } = exportData();
    return {
      title: "علامات وملاحظات الطلاب",
      subtitle: `الصف ${gradeId}${sectionId === "all" ? " — جميع الشعب" : ""} — ${rangeLabel} — ${typeLabel}`,
      meta: [
        { label: "الفترة", value: rangeLabel },
        { label: "النوع", value: typeLabel },
        { label: "عدد العلامات", value: String(allMarks.length) },
        { label: "عدد الملاحظات", value: String(allComments.length) },
      ],
      tables: [
        {
          heading: "الملخص",
          columns: ["#", "الطالب", "النسبة", "عدد العلامات"],
          rows: expSummary.map((s, i) => [i + 1, s.name, `${s.pct.toFixed(2)}%`, s.count]),
          rowLines: (r: (string | number)[]) => [`${r[0]}. ${r[1]} — ${r[2]}`],
        },
        {
          heading: "الملاحظات",
          columns: ["التاريخ", "الطالب", "التصنيف", "الملاحظة"],
          rows: allComments.map((m) => [m.date, nameOf(m.student_id), m.subject, m.notes ?? ""]),
          rowLines: (r: (string | number)[]) => {
            const parts = [String(r[1] ?? ""), String(r[2] ?? ""), String(r[3] ?? "")].filter((p) => p.trim().length > 0);
            return [parts.join(" — ")];
          },
        },
        ...groups.map((g) => ({
          heading: g.heading,
          columns: ["التاريخ", "الطالب", "المادة", "العلامة", "ملاحظة"],
          rows: g.items.map((m) => [
            m.date, nameOf(m.student_id), m.subject, `${Number(m.score)} / ${Number(m.max_score)}`, m.notes ?? "",
          ]),
          rowLines: (r: (string | number)[]) => {
            const parts = [String(r[1] ?? ""), String(r[2] ?? ""), String(r[3] ?? ""), String(r[4] ?? "")].filter((p) => p.trim().length > 0);
            return [parts.join(" — ")];
          },
        })),
      ],
      filename: `marks-grade-${gradeId}`,
    };
  }

  function exportWeeklyPDF() {
    const nameOf = (id: string) => students.find((s) => s.id === id)?.full_name ?? "-";
    const { allComments, expSummary, groups } = exportData();

    const isRecent = (_d: string) => true;
    const esc = (s: string) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const row = (cells: string[], recent: boolean) =>
      `<tr class="${recent ? "recent" : ""}">${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;

    const summaryRows = expSummary
      .map((s, i) =>
        row(
          [String(i + 1), s.name, `${s.pct.toFixed(2)}%`, String(s.count), Array.from(s.subjects).join("، ") || "-"],
          false,
        ),
      )
      .join("");

    const commentsRows = allComments
      .map((m) => row([m.date, nameOf(m.student_id), m.subject, m.notes ?? ""], isRecent(m.date)))
      .join("");

    const marksSections = groups
      .map((g) => {
        const body = g.items
          .map((m) => {
            const pct = ((Number(m.score) / Number(m.max_score)) * 100).toFixed(1) + "%";
            return row(
              [m.date, nameOf(m.student_id), m.subject, `${Number(m.score)} / ${Number(m.max_score)}`, pct, m.notes ?? "-"],
              isRecent(m.date),
            );
          })
          .join("");
        return `<h2>${esc(g.heading)}</h2><table>
        <thead><tr><th>التاريخ</th><th>الطالب</th><th>المادة</th><th>العلامة</th><th>النسبة</th><th>ملاحظة</th></tr></thead>
        <tbody>${body || `<tr><td colspan="6" class="empty">لا توجد علامات</td></tr>`}</tbody></table>`;
      })
      .join("");

    const style = `
      @page { size: A4; margin: 14mm; }
      body { font-family: "Cairo","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif; direction: rtl; color:#1E293B; margin:0; }
      header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1D4ED8; padding-bottom:10px; margin-bottom:14px; }
      .brand { color:#1D4ED8; font-weight:800; font-size:20px; }
      h1 { font-size:18px; margin:0 0 4px; }
      h2 { font-size:15px; margin:22px 0 8px; color:#1D4ED8; border-right:4px solid #1D4ED8; padding-right:8px; }
      .subtitle { color:#64748b; font-size:13px; margin-bottom:10px; }
      .legend { display:flex; gap:14px; font-size:12px; margin-bottom:10px; color:#334155; }
      .legend .sw { display:inline-block; width:14px; height:14px; border-radius:3px; vertical-align:middle; margin-left:5px; }
      table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:6px; }
      thead th { background:#1D4ED8; color:#fff; padding:8px; text-align:right; font-weight:700; }
      tbody td { padding:7px 8px; border-bottom:1px solid #e2e8f0; text-align:right; }
      tbody tr:nth-child(even) td { background:#f8fafc; }
      tbody tr.recent td { background:#fef3c7 !important; color:#92400e; font-weight:600; }
      .empty { text-align:center; color:#94a3b8; padding:14px; }
    `;

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
      <title>تقرير علامات الطلاب</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <style>${style}</style></head><body>
      <header>
        <div>
          <div class="brand">SchoolDesk — إدارة المدرسة</div>
          <h1>تقرير علامات وملاحظات الطلاب</h1>
          <div class="subtitle">الصف ${gradeId} — ${rangeLabel}</div>
        </div>
        <div class="subtitle">${new Date().toLocaleString("ar")}</div>
      </header>
      <h2>الملخص الأسبوعي</h2>
      <table>
        <thead><tr><th>#</th><th>الطالب</th><th>النسبة</th><th>عدد العلامات</th><th>المواد</th></tr></thead>
        <tbody>${summaryRows || `<tr><td colspan="5" class="empty">لا توجد علامات</td></tr>`}</tbody>
      </table>
      <h2>الملاحظات</h2>
      <table>
        <thead><tr><th>التاريخ</th><th>الطالب</th><th>التصنيف</th><th>الملاحظة</th></tr></thead>
        <tbody>${commentsRows || `<tr><td colspan="4" class="empty">لا توجد ملاحظات</td></tr>`}</tbody>
      </table>
      <h2>العلامات</h2>
      <table>
        <thead><tr><th>التاريخ</th><th>الطالب</th><th>المادة</th><th>العلامة</th><th>النسبة</th><th>ملاحظة</th></tr></thead>
        <tbody>${marksRows || `<tr><td colspan="6" class="empty">لا توجد علامات</td></tr>`}</tbody>
      </table>
      <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},400));</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">علامات الطلاب</h1>
          <p className="text-sm text-muted-foreground">إضافة العلامات، الملخص الأسبوعي، وملاحظات الطلاب</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MessageSquarePlus className="h-4 w-4 ml-1" /> إضافة ملاحظة
                </Button>
              </DialogTrigger>
              <AddNoteDialog
                students={students}
                onClose={() => setNoteOpen(false)}
                onSaved={() => qc.invalidateQueries({ queryKey: ["marks"] })}
              />
            </Dialog>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Users className="h-4 w-4 ml-1" /> علامات لشعبة كاملة
                </Button>
              </DialogTrigger>
              <BulkMarksDialog
                students={students}
                onClose={() => setBulkOpen(false)}
                onSaved={() => qc.invalidateQueries({ queryKey: ["marks"] })}
              />
            </Dialog>
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
          </div>
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
                  <SelectItem key={s.id} value={s.id}>{sectionLabel(s.section_number, s.gender)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mr-auto flex items-end gap-2">
            <div>
              <Label>فترة التصدير</Label>
              <Select value={exportRange} onValueChange={(v) => setExportRange(v as "day" | "week")}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">اليوم فقط</SelectItem>
                  <SelectItem value="week">هذا الأسبوع (7 أيام)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ExportMenu
              label="تصدير الملخص"
            sectionId={sectionId !== "all" ? sectionId : null}
            sectionTargets={sections.map((s) => ({ id: s.id, label: sectionLabel(s.section_number, s.gender) }))}
            doc={buildWeeklyDoc}
            onPdf={exportWeeklyPDF}
            />
          </div>
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
                    <Badge variant={r.pct >= 50 ? "default" : "destructive"}>{r.pct.toFixed(1)}%</Badge>
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
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notesRows.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground py-6">لا توجد ملاحظات</TableCell></TableRow>
              )}
              {notesRows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.date}</TableCell>
                  <TableCell>{n.studentName}</TableCell>
                  <TableCell>{n.subject}</TableCell>
                  <TableCell className="text-sm">{n.notes}</TableCell>
                  {canEdit && (
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setEditMark({
                        id: n.id, student_id: n.student_id, date: n.date,
                        subject: n.subject, score: n.score, max_score: n.max_score, notes: n.notes,
                      })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeMark({
                        id: n.id, student_id: n.student_id, date: n.date,
                        subject: n.subject, score: n.score, max_score: n.max_score, notes: n.notes,
                      })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
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
              {marks.filter((m) => Number(m.max_score) > 0).length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-6">لا توجد علامات</TableCell></TableRow>
              )}
              {marks.filter((m) => Number(m.max_score) > 0).map((m) => {
                const st = students.find((s) => s.id === m.student_id);
                const pct = Number(m.max_score) > 0 ? (Number(m.score) / Number(m.max_score)) * 100 : 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>{st?.full_name ?? "-"}</TableCell>
                    <TableCell>{m.subject}</TableCell>
                    <TableCell>{Number(m.score).toLocaleString("ar")} / {Number(m.max_score).toLocaleString("ar")}</TableCell>
                    <TableCell><Badge variant={pct >= 50 ? "default" : "destructive"}>{pct.toFixed(1)}%</Badge></TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{m.notes ?? "-"}</TableCell>
                    {canEdit && (
                      <TableCell className="whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => setEditMark(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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

      <Dialog open={!!editMark} onOpenChange={(o) => { if (!o) setEditMark(null); }}>
        {editMark && (
          <EditMarkDialog
            mark={editMark}
            studentName={students.find((s) => s.id === editMark.student_id)?.full_name ?? "-"}
            onClose={() => setEditMark(null)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["marks"] })}
          />
        )}
      </Dialog>
    </div>
  );
}

function EditMarkDialog({
  mark, studentName, onClose, onSaved,
}: { mark: Mark; studentName: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const isNoteOnly = Number(mark.max_score) <= 0;
  const [subject, setSubject] = useState(mark.subject);
  const [score, setScore] = useState(String(mark.score ?? ""));
  const [maxScore, setMaxScore] = useState(String(mark.max_score ?? ""));
  const [notes, setNotes] = useState(mark.notes ?? "");
  const [date, setDate] = useState(mark.date);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!subject.trim() || !date) return toast.error("يرجى تعبئة الحقول المطلوبة");
    if (!isNoteOnly && (score === "" || maxScore === "" || Number(maxScore) <= 0)) {
      return toast.error("يرجى إدخال العلامة والعلامة القصوى");
    }
    setSaving(true);
    const payload = {
      subject: subject.trim(),
      score: isNoteOnly ? Number(mark.score) : Number(score),
      max_score: isNoteOnly ? Number(mark.max_score) : Number(maxScore),
      notes: notes.trim() || null,
      date,
    };
    const { data, error } = await supabase
      .from("daily_marks").update(payload).eq("id", mark.id).select().maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("لم يتم التعديل — قد يكون السجل لمدرسة أخرى");
    await logAudit(user, "update", "daily_marks", mark.id, mark as unknown, payload);
    toast.success("تم التعديل");
    onSaved();
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{isNoteOnly ? "تعديل الملاحظة" : "تعديل العلامة"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>الطالب</Label>
          <Input value={studentName} disabled className="text-right" />
        </div>
        <div>
          <Label>{isNoteOnly ? "النوع" : "المادة"}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="text-right" />
        </div>
        {!isNoteOnly && (
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
        )}
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label>ملاحظة</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-right" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} disabled={saving}>حفظ</Button>
      </DialogFooter>
    </DialogContent>
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

function AddNoteDialog({
  students, onClose, onSaved,
}: { students: Student[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [studentId, setStudentId] = useState<string>("");
  const [category, setCategory] = useState("سلوك");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!studentId || !notes.trim()) {
      return toast.error("يرجى اختيار الطالب وكتابة الملاحظة");
    }
    setSaving(true);
    const payload = {
      student_id: studentId,
      subject: category.trim() || "ملاحظة",
      score: 0,
      max_score: 0,
      notes: notes.trim(),
      date,
      recorded_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from("daily_marks").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "daily_marks", data?.id, null, payload);
    toast.success("تمت إضافة الملاحظة");
    onSaved();
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>إضافة ملاحظة</DialogTitle></DialogHeader>
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
          <Label>نوع الملاحظة</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="سلوك">سلوك</SelectItem>
              <SelectItem value="مشاركة">مشاركة</SelectItem>
              <SelectItem value="واجب">واجب</SelectItem>
              <SelectItem value="ملاحظة">ملاحظة عامة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label>الملاحظة</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اكتب الملاحظة حول سلوك الطالب أو أدائه" className="text-right" rows={4} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} disabled={saving}>حفظ</Button>
      </DialogFooter>
    </DialogContent>
  );
}
