import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HandCoins, Users } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { fetchAll } from "@/lib/fetch-all";
import { computeBalances } from "@/lib/student-balances";
import { gradeSectionLabel } from "@/lib/section-label";

type StudentInfo = {
  id: string;
  full_name: string;
  grade_id: number;
  guardian_phone: string | null;
  is_active: boolean;
  sections: { section_number: number; gender: string } | null;
};

function useBalances() {
  return useQuery({
    queryKey: ["student-balances"],
    queryFn: async () => {
      const [plans, payments, students] = await Promise.all([
        fetchAll((from, to) =>
          supabase.from("student_payment_plans").select("student_id, amount").order("id").range(from, to),
        ),
        fetchAll((from, to) =>
          supabase.from("student_payments").select("student_id, amount, currency").order("id").range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("students")
            .select("id, full_name, grade_id, guardian_phone, is_active, sections(section_number, gender)")
            .order("id")
            .range(from, to),
        ),
      ]);
      const byId = new Map((students as unknown as StudentInfo[]).map((s) => [s.id, s]));
      return computeBalances(plans, payments)
        .map((b) => ({ ...b, student: byId.get(b.studentId) }))
        .filter((b) => !!b.student);
    },
  });
}

export default function StudentBalances() {
  const { data: rows = [], isLoading } = useBalances();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((r) => r.student!.full_name.includes(q) || (r.student!.guardian_phone ?? "").includes(q));
  }, [rows, search]);

  const totalOwed = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-destructive/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">إجمالي المبالغ المستحقة على الطلاب</CardTitle>
            <HandCoins className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatMoney(totalOwed, "SYP")}</div>
            <p className="text-xs text-muted-foreground">باقي الأقساط كاملة بعد طرح ما دُفع بالليرة السورية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">عدد الطلاب المدينين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">المبالغ المتبقية على كل طالب</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو هاتف ولي الأمر"
            className="w-full sm:w-64"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الطالب</TableHead>
                <TableHead className="text-right">الصف والشعبة</TableHead>
                <TableHead className="text-right">إجمالي الأقساط</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">هاتف ولي الأمر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">جارٍ التحميل…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد مبالغ مستحقة</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const s = r.student!;
                return (
                  <TableRow key={r.studentId}>
                    <TableCell>
                      <Link to="/students/$id" params={{ id: r.studentId }} className="font-medium text-primary">
                        {s.full_name}
                      </Link>
                      {!s.is_active && <Badge variant="secondary" className="mr-2">موقوف</Badge>}
                    </TableCell>
                    <TableCell>{gradeSectionLabel(s.grade_id, s.sections?.section_number, s.sections?.gender)}</TableCell>
                    <TableCell className="font-mono">{formatMoney(r.totalFee, "SYP")}</TableCell>
                    <TableCell className="font-mono">{formatMoney(r.paid, "SYP")}</TableCell>
                    <TableCell className="font-mono font-semibold text-destructive">{formatMoney(r.remaining, "SYP")}</TableCell>
                    <TableCell>{s.guardian_phone ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            الأقساط مسجّلة بالليرة السورية، لذلك لا تُطرح المدفوعات بالدولار منها.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
