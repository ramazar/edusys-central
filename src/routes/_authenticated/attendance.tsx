import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, CheckCheck, FileText, Printer } from "lucide-react";
import { useAuthSession, logAudit } from "@/hooks/useAuth";
import { printReport } from "@/lib/print-pdf";


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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>قائمة الطلاب ({students.length})</CardTitle>
          <Button size="lg" onClick={saveAll} disabled={students.length === 0}>حفظ الكل</Button>
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
    </div>
  );
}
