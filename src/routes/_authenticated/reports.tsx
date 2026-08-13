import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ExportMenu";
import { sectionLabel, genderLabel } from "@/lib/section-label";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

type Period = "weekly" | "all";

function periodStart(period: Period): string | null {
  if (period === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - 6); // last 7 days incl. today
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const [gradeId, setGradeId] = useState<number>(1);
  const [period, setPeriod] = useState<Period>("weekly");

  const { data: sections = [] } = useQuery({
    queryKey: ["sections-report", gradeId],
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

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", gradeId, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, student_number, grade_id, section_id, sections(section_number, gender)")
        .eq("grade_id", gradeId)
        .eq("is_active", true);
      const students = (data ?? []) as Array<{
        id: string; full_name: string; student_number: string; grade_id: number;
        section_id: string | null; sections: { section_number: number; gender: string | null } | null;
      }>;
      const ids = students.map((s) => s.id);
      if (ids.length === 0) return [];
      const from = periodStart(period);
      let marksQuery = supabase.from("daily_marks").select("student_id, score, max_score, date").in("student_id", ids);
      if (from) marksQuery = marksQuery.gte("date", from);
      const { data: marks } = await marksQuery;
      const totals: Record<string, { sum: number; count: number }> = {};
      (marks ?? []).forEach((m) => {
        const t = totals[m.student_id] || { sum: 0, count: 0 };
        const pct = Number(m.max_score) > 0 ? (Number(m.score) / Number(m.max_score)) * 100 : Number(m.score);
        t.sum += pct; t.count += 1;
        totals[m.student_id] = t;
      });
      return students
        .map((s) => {
          const t = totals[s.id] || { sum: 0, count: 0 };
          return { ...s, avg: t.count > 0 ? t.sum / t.count : 0, count: t.count };
        })
        .sort((a, b) => b.avg - a.avg);
    },
  });

  const periodLabel = period === "weekly" ? "الأسبوع الحالي (آخر 7 أيام)" : "كل الفترات";

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(
      ranking.map((r, i) => ({
        "الترتيب": i + 1,
        "رقم الطالب": r.student_number,
        "الاسم": r.full_name,
        "الصف": r.grade_id,
        "الشعبة": r.sections ? `${r.sections.section_number} (${genderLabel(r.sections.gender)})` : "-",
        "المعدل": r.avg.toFixed(2),
        "عدد الدرجات": r.count,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الترتيب");
    XLSX.writeFile(wb, `ranking-grade-${gradeId}.xlsx`);
  };

  const gradeCols = [
    { header: "الترتيب", width: "10%", align: "center" as const },
    { header: "اسم الطالب", width: "34%" },
    { header: "رقم الطالب", width: "18%" },
    { header: "الشعبة", width: "14%" },
    { header: "المعدل %", width: "12%", align: "center" as const },
    { header: "عدد الدرجات", width: "12%", align: "center" as const },
  ];
  const sectionCols = [
    { header: "الترتيب", width: "10%", align: "center" as const },
    { header: "اسم الطالب", width: "40%" },
    { header: "رقم الطالب", width: "20%" },
    { header: "المعدل %", width: "15%", align: "center" as const },
    { header: "عدد الدرجات", width: "15%", align: "center" as const },
  ];

  const buildGradeDoc = () => {
    if (ranking.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return null;
    }
    return {
      title: `ترتيب الصف ${gradeId} — ${periodLabel}`,
      subtitle: "ترتيب الطلاب حسب المعدل العام",
      meta: [
        { label: "الصف", value: String(gradeId) },
        { label: "الفترة", value: periodLabel },
        { label: "عدد الطلاب", value: String(ranking.length) },
      ],
      tables: [
        {
          columns: gradeCols.map((c) => c.header),
          rows: ranking.map((r, i) => [
            i + 1,
            r.full_name,
            r.student_number,
            sectionLabel(r.sections?.section_number, r.sections?.gender),
            r.avg.toFixed(2),
            r.count,
          ]),
        },
      ],
      filename: `ranking-grade-${gradeId}`,
    };
  };

  const buildSectionDoc = (sectionId: string, sectionNumber: number, gender: string | null) => () => {
    const filtered = ranking.filter((r) => r.section_id === sectionId);
    if (filtered.length === 0) {
      toast.error("لا يوجد طلاب في هذه الشعبة");
      return null;
    }
    return {
      title: `ترتيب الصف ${gradeId} — ${sectionLabel(sectionNumber, gender)}`,
      subtitle: periodLabel,
      meta: [
        { label: "الصف", value: String(gradeId) },
        { label: "الشعبة", value: sectionLabel(sectionNumber, gender) },
        { label: "الفترة", value: periodLabel },
        { label: "عدد الطلاب", value: String(filtered.length) },
      ],
      tables: [
        {
          columns: sectionCols.map((c) => c.header),
          rows: filtered.map((r, i) => [i + 1, r.full_name, r.student_number, r.avg.toFixed(2), r.count]),
        },
      ],
      filename: `ranking-grade-${gradeId}-section-${sectionNumber}`,
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">التقارير والترتيب</h1>
        <p className="text-sm text-muted-foreground">ترتيب الطلاب حسب المعدل العام مع تصدير PDF للصف وكل شعبة</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label>الصف:</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={gradeId}
                onChange={(e) => setGradeId(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>{`الصف ${g}`}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label>الفترة:</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
              >
                <option value="weekly">أسبوعي (آخر 7 أيام)</option>
                <option value="all">كل الفترات</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportXlsx} disabled={ranking.length === 0}>
              <Download className="ml-2 h-4 w-4" /> Excel
            </Button>
            <ExportMenu
              variant="default"
              label="تصدير الصف بأكمله"
              sectionTargets={sections.map((s) => ({ id: s.id, label: sectionLabel(s.section_number, s.gender) }))}
              doc={buildGradeDoc}
              disabled={ranking.length === 0}
              pdfColumns={gradeCols}
            />
          </div>
        </CardHeader>

        {sections.length > 0 && (
          <div className="border-t px-6 py-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">تصدير لكل شعبة (PDF / نص / واتساب):</div>
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <ExportMenu
                  key={s.id}
                  size="sm"
                  variant="secondary"
                  label={sectionLabel(s.section_number, s.gender)}
                  sectionId={s.id}
                  doc={buildSectionDoc(s.id, s.section_number, s.gender)}
                  pdfColumns={sectionCols}
                />
              ))}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الترتيب</TableHead>
                <TableHead className="text-right">الطالب</TableHead>
                <TableHead className="text-right">رقم الطالب</TableHead>
                <TableHead className="text-right">الشعبة</TableHead>
                <TableHead className="text-right">المعدل</TableHead>
                <TableHead className="text-right">عدد الدرجات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    لا توجد بيانات
                  </TableCell>
                </TableRow>
              )}
              {ranking.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {i === 0 && (
                      <Badge className="bg-warning text-warning-foreground">
                        <Trophy className="ml-1 h-3 w-3" /> 1
                      </Badge>
                    )}
                    {i === 1 && (
                      <Badge className="bg-muted">
                        <Trophy className="ml-1 h-3 w-3" /> 2
                      </Badge>
                    )}
                    {i === 2 && (
                      <Badge className="bg-muted">
                        <Trophy className="ml-1 h-3 w-3" /> 3
                      </Badge>
                    )}
                    {i > 2 && <span className="font-mono">{i + 1}</span>}
                  </TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="font-mono">{r.student_number}</TableCell>
                  <TableCell>{r.sections ? `${r.sections.section_number} (${genderLabel(r.sections.gender)})` : "-"}</TableCell>
                  <TableCell className="font-mono">{r.avg.toFixed(2)}</TableCell>
                  <TableCell>{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
