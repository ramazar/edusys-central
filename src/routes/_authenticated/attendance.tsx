import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, CheckCheck, MessageCircle } from "lucide-react";
import { useAuthSession, logAudit } from "@/hooks/useAuth";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppSendDialog } from "@/components/attendance/WhatsAppSendDialog";
import { sectionLabel } from "@/lib/section-label";


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
  const [lateMap, setLateMap] = useState<Record<string, number>>({});
  const [waOpen, setWaOpen] = useState(false);

  const { data: sections = [] } = useQuery({
    queryKey: ["sections-att", gradeId],
    queryFn: async () => {
      const { data } = await supabase.from("sections").select("id, section_number, gender").eq("grade_id", gradeId).eq("is_active", true).order("section_number");
      return data ?? [];
    },
  });

  useEffect(() => { setSectionId(sections[0]?.id ?? ""); }, [sections]);

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students-in-section", sectionId, date],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data: st } = await supabase.from("students").select("id, full_name, student_number, guardian_phone, guardian_name").eq("section_id", sectionId).eq("is_active", true).order("full_name");
      const students = st ?? [];
      const { data: att } = await supabase.from("attendance").select("student_id, status, late_minutes").eq("date", date).in("student_id", students.map((s) => s.id));
      const map: Record<string, Status> = {};
      const lm: Record<string, number> = {};
      students.forEach((s) => (map[s.id] = "present"));
      (att ?? []).forEach((a) => {
        map[a.student_id] = a.status as Status;
        if (a.late_minutes != null) lm[a.student_id] = Number(a.late_minutes);
      });
      setAttMap(map);
      setLateMap(lm);
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
    const rows = students.map((s) => {
      const st = attMap[s.id] || "present";
      return {
        student_id: s.id,
        date,
        status: st,
        late_minutes: st === "late" ? Number(lateMap[s.id] ?? 0) : null,
        recorded_by: user?.id,
      };
    });
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    if (error) return toast.error(error.message);
    await logAudit(user, "bulk_upsert", "attendance", sectionId, null, { count: rows.length, date });
    toast.success(`تم حفظ حضور ${rows.length} طالب`);
    refetch();
  };

  const statusLabel = (s: Status, minutes?: number | null) =>
    s === "present" ? "حاضر" : s === "late" ? `متأخر${minutes ? ` (${minutes} دقيقة)` : ""}` : "غائب";

  const buildSectionDoc = () => {
    if (students.length === 0) {
      toast.error("لا يوجد طلاب في هذه الشعبة");
      return null;
    }
    const section = sections.find((x) => x.id === sectionId);
    // Export only the students who were absent or late, with the lateness time.
    const flagged = students
      .map((s, i) => ({
        name: s.full_name,
        status: (attMap[s.id] || "present") as Status,
        minutes: lateMap[s.id],
      }))
      .filter((x) => x.status !== "present")
      .map((x, i) => [i + 1, x.name, statusLabel(x.status, x.minutes)]);
    return {
      title: `كشف الحضور — الصف ${gradeId} / ${sectionLabel(section?.section_number, section?.gender)}`,
      subtitle: `التاريخ: ${date}`,
      meta: [
        { label: "الصف", value: String(gradeId) },
        { label: "الشعبة", value: sectionLabel(section?.section_number, section?.gender) },
        { label: "التاريخ", value: date },
        { label: "إجمالي الطلاب", value: String(students.length) },
      ],
      tables: [
        {
          heading: "الغياب والتأخير",
          columns: ["#", "اسم الطالب", "الحالة"],
          rows: flagged,
          rowLines: (r: (string | number)[]) => [`${r[1]} — ${r[2]}`],
        },
      ],
      filename: `attendance-section-${date}`,
    };
  };

  const buildGradeDoc = async () => {
    if (sections.length === 0) {
      toast.error("لا توجد شُعب في هذا الصف");
      return null;
    }
    const secIds = sections.map((s) => s.id);
    const { data: allStudents } = await supabase
      .from("students")
      .select("id, full_name, student_number, section_id")
      .in("section_id", secIds)
      .eq("is_active", true)
      .order("full_name");
    const list = allStudents ?? [];
    if (list.length === 0) {
      toast.error("لا يوجد طلاب في هذا الصف");
      return null;
    }
    const { data: att } = await supabase
      .from("attendance")
      .select("student_id, status, late_minutes")
      .eq("date", date)
      .in("student_id", list.map((s) => s.id));
    const map: Record<string, Status> = {};
    const lm: Record<string, number> = {};
    (att ?? []).forEach((a) => {
      map[a.student_id] = a.status as Status;
      if (a.late_minutes != null) lm[a.student_id] = Number(a.late_minutes);
    });

    const rows: (string | number)[][] = [];
    let idx = 0;
    const counts = { present: 0, late: 0, absent: 0 } as Record<Status, number>;
    for (const sec of sections) {
      const inSec = list.filter((x) => x.section_id === sec.id);
      inSec.forEach((s) => {
        const st = (map[s.id] || "present") as Status;
        counts[st]++;
        rows.push([++idx, s.full_name, s.student_number, sectionLabel(sec.section_number, sec.gender), statusLabel(st, lm[s.id])]);
      });
    }
    return {
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
      tables: [
        {
          columns: ["#", "اسم الطالب", "رقم الطالب", "الشعبة", "الحالة"],
          rows,
          rowLines: (r: (string | number)[]) => [`${r[1]} — ${r[3]} — ${r[4]}`],
        },
      ],
      filename: `attendance-grade-${gradeId}-${date}`,
    };
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
                {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s.section_number, s.gender)}</option>)}
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
            <ExportMenu
              label="تصدير الشعبة"
              sectionId={sectionId}
              doc={buildSectionDoc}
              disabled={students.length === 0}
              pdfColumns={[
                { header: "#", width: "8%", align: "center" },
                { header: "اسم الطالب", width: "50%" },
                { header: "رقم الطالب", width: "22%" },
                { header: "الحالة", width: "20%", align: "center" },
              ]}
            />
            <ExportMenu
              label="تصدير كل الشُعب"
              sectionTargets={sections.map((s) => ({ id: s.id, label: sectionLabel(s.section_number, s.gender) }))}
              doc={buildGradeDoc}
              disabled={sections.length === 0}
              pdfColumns={[
                { header: "#", width: "7%", align: "center" },
                { header: "اسم الطالب", width: "38%" },
                { header: "رقم الطالب", width: "20%" },
                { header: "الشعبة", width: "17%", align: "center" },
                { header: "الحالة", width: "18%", align: "center" },
              ]}
            />
            <Button
              variant="outline"
              className="border-success text-success hover:bg-success/10"
              onClick={() => setWaOpen(true)}
              disabled={students.length === 0}
            >
              <MessageCircle className="ml-2 h-4 w-4" /> واتساب لأولياء الأمور
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
                  {status === "late" && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={600}
                        value={lateMap[s.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => setLateMap({ ...lateMap, [s.id]: Math.max(0, Number(e.target.value || 0)) })}
                        className="h-9 w-20 text-center"
                      />
                      <span className="text-xs text-muted-foreground">دقيقة</span>
                    </div>
                  )}
                  <Button size="sm" variant={status === "absent" ? "destructive" : "outline"} onClick={() => setAttMap({ ...attMap, [s.id]: "absent" })}>
                    <X className="ml-1 h-4 w-4" /> غائب
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <WhatsAppSendDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        students={students as never}
        absentIds={students.filter((s) => (attMap[s.id] || "present") === "absent").map((s) => s.id)}
        contextLabel={date}
      />
    </div>
  );
}
