import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, CheckCheck, FileText, Printer, Grid3x3, Save } from "lucide-react";
import { useAuthSession, logAudit } from "@/hooks/useAuth";
import { printReport } from "@/lib/print-pdf";
import { printAttendanceGrid, type GridCell } from "@/lib/attendance-grid-pdf";


export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type Status = "present" | "absent" | "late";

function AttendancePage() {
  const { user } = useAuthSession();
  const [gradeId, setGradeId] = useState<number>(1);
  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attMap, setAttMap] = useState<Record<string, Status>>({});

  const { data: sections = [] } = useQuery({
    queryKey: ["sections-att", gradeId],
    queryFn: async () => {
      const { data } = await supabase.from("sections").select("id, section_number").eq("grade_id", gradeId).eq("is_active", true).order("section_number");
      return data ?? [];
    },
  });

  useEffect(() => { setSectionId(sections[0]?.id ?? ""); }, [sections]);

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students-in-section", sectionId, date],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data: st } = await supabase.from("students").select("id, full_name, student_number").eq("section_id", sectionId).eq("is_active", true).order("full_name");
      const students = st ?? [];
      const { data: att } = await supabase.from("attendance").select("student_id, status").eq("date", date).in("student_id", students.map((s) => s.id));
      const map: Record<string, Status> = {};
      students.forEach((s) => (map[s.id] = "present"));
      (att ?? []).forEach((a) => (map[a.student_id] = a.status as Status));
      setAttMap(map);
      return students;
    },
  });

  const markAll = (status: Status) => {
    const m: Record<string, Status> = {};
    students.forEach((s) => (m[s.id] = status));
    setAttMap(m);
  };

  const saveAll = async () => {
    if (!sectionId || students.length === 0) return;
    const rows = students.map((s) => ({
      student_id: s.id, date, status: attMap[s.id] || "present", recorded_by: user?.id,
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    if (error) return toast.error(error.message);
    await logAudit(user, "bulk_upsert", "attendance", sectionId, null, { count: rows.length, date });
    toast.success(`تم حفظ حضور ${rows.length} طالب`);
    refetch();
  };

  const statusLabel = (s: Status) => (s === "present" ? "حاضر" : s === "late" ? "متأخر" : "غائب");

  const exportSectionPDF = () => {
    if (students.length === 0) return toast.error("لا يوجد طلاب في هذه الشعبة");
    const section = sections.find((x) => x.id === sectionId);
    const counts = { present: 0, late: 0, absent: 0 } as Record<Status, number>;
    const rows = students.map((s, i) => {
      const st = (attMap[s.id] || "present") as Status;
      counts[st]++;
      return [i + 1, s.full_name, s.student_number, statusLabel(st)];
    });
    printReport({
      title: `كشف الحضور — الصف ${gradeId} / الشعبة ${section?.section_number ?? "-"}`,
      subtitle: `التاريخ: ${date}`,
      meta: [
        { label: "الصف", value: String(gradeId) },
        { label: "الشعبة", value: String(section?.section_number ?? "-") },
        { label: "التاريخ", value: date },
        { label: "إجمالي الطلاب", value: String(students.length) },
        { label: "حاضر", value: String(counts.present) },
        { label: "متأخر", value: String(counts.late) },
        { label: "غائب", value: String(counts.absent) },
      ],
      columns: [
        { header: "#", width: "8%", align: "center" },
        { header: "اسم الطالب", width: "50%" },
        { header: "رقم الطالب", width: "22%" },
        { header: "الحالة", width: "20%", align: "center" },
      ],
      rows,
    });
  };

  const exportGradePDF = async () => {
    if (sections.length === 0) return toast.error("لا توجد شُعب في هذا الصف");
    const secIds = sections.map((s) => s.id);
    const { data: allStudents } = await supabase
      .from("students")
      .select("id, full_name, student_number, section_id")
      .in("section_id", secIds)
      .eq("is_active", true)
      .order("full_name");
    const list = allStudents ?? [];
    if (list.length === 0) return toast.error("لا يوجد طلاب في هذا الصف");
    const { data: att } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("date", date)
      .in("student_id", list.map((s) => s.id));
    const map: Record<string, Status> = {};
    (att ?? []).forEach((a) => (map[a.student_id] = a.status as Status));

    const rows: (string | number)[][] = [];
    let idx = 0;
    const counts = { present: 0, late: 0, absent: 0 } as Record<Status, number>;
    for (const sec of sections) {
      const inSec = list.filter((x) => x.section_id === sec.id);
      inSec.forEach((s) => {
        const st = (map[s.id] || "present") as Status;
        counts[st]++;
        rows.push([++idx, s.full_name, s.student_number, `الشعبة ${sec.section_number}`, statusLabel(st)]);
      });
    }
    printReport({
      title: `كشف الحضور — الصف ${gradeId} (جميع الشُعب)`,
      subtitle: `التاريخ: ${date}`,
      meta: [
        { label: "الصف", value: String(gradeId) },
        { label: "عدد الشُعب", value: String(sections.length) },
        { label: "التاريخ", value: date },
        { label: "إجمالي الطلاب", value: String(list.length) },
        { label: "حاضر", value: String(counts.present) },
        { label: "متأخر", value: String(counts.late) },
        { label: "غائب", value: String(counts.absent) },
      ],
      columns: [
        { header: "#", width: "7%", align: "center" },
        { header: "اسم الطالب", width: "38%" },
        { header: "رقم الطالب", width: "20%" },
        { header: "الشعبة", width: "17%", align: "center" },
        { header: "الحالة", width: "18%", align: "center" },
      ],
      rows,
    });
  };


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الحضور والغياب</h1>
        <p className="text-sm text-muted-foreground">تسجيل حضور الشعبة بأكملها في خطوة واحدة</p>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div><Label>الصف</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={gradeId} onChange={(e) => setGradeId(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{`الصف ${g}`}</option>)}
              </select>
            </div>
            <div><Label>الشعبة</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                {sections.map((s) => <option key={s.id} value={s.id}>{`الشعبة ${s.section_number}`}</option>)}
                {sections.length === 0 && <option value="">لا توجد شُعب</option>}
              </select>
            </div>
            <div><Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => markAll("present")}>
                <CheckCheck className="ml-2 h-4 w-4" /> تحديد الكل حاضر
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>قائمة الطلاب ({students.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportSectionPDF} disabled={students.length === 0}>
              <Printer className="ml-2 h-4 w-4" /> PDF للشعبة
            </Button>
            <Button variant="outline" onClick={exportGradePDF} disabled={sections.length === 0}>
              <FileText className="ml-2 h-4 w-4" /> PDF لكل الشُعب في الصف
            </Button>
            <Button size="lg" onClick={saveAll} disabled={students.length === 0}>حفظ الكل</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {students.length === 0 && <div className="py-6 text-center text-muted-foreground">لا يوجد طلاب في هذه الشعبة</div>}
          {students.map((s) => {
            const status = attMap[s.id] || "present";
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 hover:bg-muted/40">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">{s.student_number}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={status === "present" ? "default" : "outline"} className={status === "present" ? "bg-success hover:bg-success/90" : ""} onClick={() => setAttMap({ ...attMap, [s.id]: "present" })}>
                    <Check className="ml-1 h-4 w-4" /> حاضر
                  </Button>
                  <Button size="sm" variant={status === "late" ? "default" : "outline"} className={status === "late" ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""} onClick={() => setAttMap({ ...attMap, [s.id]: "late" })}>
                    <Clock className="ml-1 h-4 w-4" /> متأخر
                  </Button>
                  <Button size="sm" variant={status === "absent" ? "destructive" : "outline"} onClick={() => setAttMap({ ...attMap, [s.id]: "absent" })}>
                    <X className="ml-1 h-4 w-4" /> غائب
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {sectionId && <AttendanceGridCard sectionId={sectionId} gradeId={gradeId} sectionNumber={sections.find((s) => s.id === sectionId)?.section_number} />}
    </div>
  );
}

function AttendanceGridCard({ sectionId, gradeId, sectionNumber }: { sectionId: string; gradeId: number; sectionNumber?: number }) {
  const { user } = useAuthSession();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(today.getDate() - 13);
  const [from, setFrom] = useState(iso(twoWeeksAgo));
  const [to, setTo] = useState(iso(today));
  const [grid, setGrid] = useState<Record<string, Record<string, GridCell>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set()); // "studentId|date"

  const dates = (() => {
    const out: string[] = [];
    const start = new Date(from); const end = new Date(to);
    if (end < start) return out;
    for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) out.push(iso(d));
    return out;
  })();

  const { data: students = [] } = useQuery({
    queryKey: ["grid-students", sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, full_name").eq("section_id", sectionId).eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: attRows = [], refetch } = useQuery({
    queryKey: ["grid-att", sectionId, from, to],
    enabled: !!sectionId && dates.length > 0,
    queryFn: async () => {
      const ids = students.map((s) => s.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("attendance").select("student_id, date, status").in("student_id", ids).gte("date", from).lte("date", to);
      return data ?? [];
    },
  });

  useEffect(() => {
    const g: Record<string, Record<string, GridCell>> = {};
    students.forEach((s) => (g[s.id] = {}));
    attRows.forEach((r: any) => {
      if (!g[r.student_id]) g[r.student_id] = {};
      g[r.student_id][r.date] = r.status as GridCell;
    });
    setGrid(g);
    setDirty(new Set());
  }, [attRows, students]);

  const cycle = (cur: GridCell): GridCell => {
    if (cur === "present") return "absent";
    if (cur === "absent") return null;
    return "present";
  };

  const toggle = (studentId: string, date: string) => {
    setGrid((prev) => {
      const next = { ...prev, [studentId]: { ...(prev[studentId] || {}) } };
      next[studentId][date] = cycle(prev[studentId]?.[date] ?? null);
      return next;
    });
    setDirty((prev) => new Set(prev).add(`${studentId}|${date}`));
  };

  const save = async () => {
    if (dirty.size === 0) return toast.info("لا يوجد تغييرات");
    const upserts: any[] = [];
    const deletes: { student_id: string; date: string }[] = [];
    dirty.forEach((k) => {
      const [sid, date] = k.split("|");
      const v = grid[sid]?.[date] ?? null;
      if (v === null) deletes.push({ student_id: sid, date });
      else upserts.push({ student_id: sid, date, status: v, recorded_by: user?.id });
    });
    if (upserts.length) {
      const { error } = await supabase.from("attendance").upsert(upserts, { onConflict: "student_id,date" });
      if (error) return toast.error(error.message);
    }
    for (const d of deletes) {
      await supabase.from("attendance").delete().eq("student_id", d.student_id).eq("date", d.date);
    }
    await logAudit(user, "grid_upsert", "attendance", sectionId, null, { count: dirty.size });
    toast.success(`تم حفظ ${dirty.size} تغيير`);
    setDirty(new Set());
    refetch();
  };

  const exportPDF = () => {
    if (students.length === 0 || dates.length === 0) return toast.error("لا يوجد بيانات");
    printAttendanceGrid({
      title: `سجل الحضور — الصف ${gradeId} / الشعبة ${sectionNumber ?? "-"}`,
      subtitle: `من ${from} إلى ${to}`,
      dates,
      students,
      cells: grid,
    });
  };

  const fmtHeader = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(d)}/${Number(m)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2"><Grid3x3 className="h-5 w-5" /> شبكة الحضور (نطاق أيام)</CardTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" /></div>
          <div><Label className="text-xs">إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" /></div>
          <Button variant="outline" onClick={exportPDF} disabled={students.length === 0}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
          <Button onClick={save} disabled={dirty.size === 0}><Save className="ml-2 h-4 w-4" /> حفظ ({dirty.size})</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground">اضغط على الخلية للتبديل: فارغ ← ✅ حاضر ← ❌ غائب ← فارغ.</p>
        <div className="overflow-auto max-h-[70vh] border rounded-md">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="border p-1 w-8">#</th>
                <th className="border p-2 text-right min-w-[160px] sticky right-0 bg-muted">الاسم</th>
                {dates.map((d) => (
                  <th key={d} className="border p-1 whitespace-nowrap font-mono" style={{ minWidth: 52 }} dir="ltr">{fmtHeader(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={dates.length + 2} className="p-4 text-center text-muted-foreground">لا يوجد طلاب</td></tr>}
              {students.map((s, i) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="border p-1 text-center text-muted-foreground">{i + 1}</td>
                  <td className="border p-2 text-right font-medium sticky right-0 bg-background">{s.full_name}</td>
                  {dates.map((d) => {
                    const v = grid[s.id]?.[d] ?? null;
                    const isDirty = dirty.has(`${s.id}|${d}`);
                    const base = "border p-0 text-center cursor-pointer select-none w-10 h-8 hover:opacity-80";
                    const bg = v === "present" ? "bg-success/20 text-success" : v === "absent" ? "bg-destructive/20 text-destructive" : v === "late" ? "bg-warning/20 text-warning" : "";
                    return (
                      <td key={d} className={`${base} ${bg} ${isDirty ? "ring-2 ring-inset ring-primary" : ""}`} onClick={() => toggle(s.id, d)}>
                        {v === "present" ? "✅" : v === "absent" ? "❌" : v === "late" ? "⏰" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
