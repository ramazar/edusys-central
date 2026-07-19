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

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const [gradeId, setGradeId] = useState<number>(1);

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", gradeId],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, full_name, student_number, grade_id").eq("grade_id", gradeId).eq("is_active", true);
      const students = data ?? [];
      const ids = students.map((s) => s.id);
      if (ids.length === 0) return [];
      const { data: marks } = await supabase.from("daily_marks").select("student_id, score, max_score").in("student_id", ids);
      const totals: Record<string, { sum: number; count: number }> = {};
      (marks ?? []).forEach((m) => {
        const t = totals[m.student_id] || { sum: 0, count: 0 };
        const pct = Number(m.max_score) > 0 ? (Number(m.score) / Number(m.max_score)) * 100 : Number(m.score);
        t.sum += pct; t.count += 1;
        totals[m.student_id] = t;
      });
      return students.map((s) => {
        const t = totals[s.id] || { sum: 0, count: 0 };
        return { ...s, avg: t.count > 0 ? t.sum / t.count : 0, count: t.count };
      }).sort((a, b) => b.avg - a.avg);
    },
  });

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(ranking.map((r, i) => ({
      "الترتيب": i + 1, "رقم الطالب": r.student_number, "الاسم": r.full_name, "الصف": r.grade_id, "المعدل": r.avg.toFixed(2), "عدد الدرجات": r.count,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الترتيب");
    XLSX.writeFile(wb, `ranking-grade-${gradeId}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">التقارير والترتيب</h1>
        <p className="text-sm text-muted-foreground">ترتيب الطلاب حسب المعدل العام</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Label>الصف:</Label>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={gradeId} onChange={(e) => setGradeId(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{`الصف ${g}`}</option>)}
            </select>
          </div>
          <Button variant="outline" onClick={exportXlsx} disabled={ranking.length === 0}>
            <Download className="ml-2 h-4 w-4" /> تصدير Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">الترتيب</TableHead>
            <TableHead className="text-right">الطالب</TableHead>
            <TableHead className="text-right">رقم الطالب</TableHead>
            <TableHead className="text-right">المعدل</TableHead>
            <TableHead className="text-right">عدد الدرجات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {ranking.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
            {ranking.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell>
                  {i === 0 && <Badge className="bg-warning text-warning-foreground"><Trophy className="ml-1 h-3 w-3" /> 1</Badge>}
                  {i === 1 && <Badge className="bg-muted"><Trophy className="ml-1 h-3 w-3" /> 2</Badge>}
                  {i === 2 && <Badge className="bg-muted"><Trophy className="ml-1 h-3 w-3" /> 3</Badge>}
                  {i > 2 && <span className="font-mono">{i + 1}</span>}
                </TableCell>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="font-mono">{r.student_number}</TableCell>
                <TableCell className="font-mono">{r.avg.toFixed(2)}</TableCell>
                <TableCell>{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
