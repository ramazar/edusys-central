import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock } from "lucide-react";
import { asCurrency, formatMoney } from "@/lib/currency";

type Row = {
  studentId: string;
  name: string;
  gradeId: number;
  phone: string | null;
  dueDate: string;
  amount: number;
  status: "late" | "soon";
  days: number;
};

const dayMs = 86400000;

function useDues() {
  return useQuery({
    queryKey: ["payment-dues"],
    queryFn: async (): Promise<Row[]> => {
      const [plansRes, paymentsRes] = await Promise.all([
        supabase
          .from("student_payment_plans")
          .select("student_id, amount, due_date, students(full_name, grade_id, guardian_phone, is_active)")
          .order("due_date"),
        supabase.from("student_payments").select("student_id, amount, currency"),
      ]);

      // Payment plans are recorded in SYP (no currency column), so only SYP
      // payments may be netted against them — USD payments are tracked separately.
      const paid = new Map<string, number>();
      for (const p of paymentsRes.data ?? []) {
        if (asCurrency(p.currency) !== "SYP") continue;
        paid.set(p.student_id, (paid.get(p.student_id) ?? 0) + Number(p.amount));
      }

      const byStudent = new Map<
        string,
        { student: { full_name: string; grade_id: number; guardian_phone: string | null; is_active: boolean } | null; plans: { amount: number; due_date: string }[] }
      >();
      for (const p of plansRes.data ?? []) {
        const student = p.students as
          | { full_name: string; grade_id: number; guardian_phone: string | null; is_active: boolean }
          | null;
        const entry = byStudent.get(p.student_id) ?? { student, plans: [] };
        entry.plans.push({ amount: Number(p.amount), due_date: p.due_date });
        byStudent.set(p.student_id, entry);
      }

      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const rows: Row[] = [];

      for (const [studentId, { student, plans }] of byStudent) {
        if (!student || student.is_active === false) continue;
        let remaining = paid.get(studentId) ?? 0;
        // allocate payments to installments in due-date order
        for (const inst of plans.sort((a, b) => a.due_date.localeCompare(b.due_date))) {
          if (remaining >= inst.amount) {
            remaining -= inst.amount;
            continue;
          }
          const outstanding = inst.amount - remaining;
          remaining = 0;
          const days = Math.round(
            (new Date(inst.due_date + "T00:00:00").getTime() - new Date(todayKey + "T00:00:00").getTime()) / dayMs,
          );
          if (days < 0) rows.push({ studentId, name: student.full_name, gradeId: student.grade_id, phone: student.guardian_phone, dueDate: inst.due_date, amount: outstanding, status: "late", days: -days });
          else if (days <= 7) rows.push({ studentId, name: student.full_name, gradeId: student.grade_id, phone: student.guardian_phone, dueDate: inst.due_date, amount: outstanding, status: "soon", days });
          break; // only the earliest unpaid installment per student
        }
      }

      return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },
  });
}

export default function PaymentDues() {
  const { data: rows = [], isLoading } = useDues();
  const late = rows.filter((r) => r.status === "late");
  const soon = rows.filter((r) => r.status === "soon");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-destructive/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">متأخرون عن السداد</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{late.length}</div>
            <p className="text-xs text-muted-foreground">
              بمجموع {formatMoney(late.reduce((s, r) => s + r.amount, 0), "SYP")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-warning/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">استحقاق خلال 7 أيام</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{soon.length}</div>
            <p className="text-xs text-muted-foreground">
              بمجموع {formatMoney(soon.reduce((s, r) => s + r.amount, 0), "SYP")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">قائمة المتأخرات والاستحقاقات القريبة</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الطالب</TableHead>
                <TableHead className="text-right">الصف</TableHead>
                <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                <TableHead className="text-right">المبلغ المستحق</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">هاتف ولي الأمر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">جارٍ التحميل…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد متأخرات أو استحقاقات قريبة</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow
                  key={r.studentId}
                  className={r.status === "late" ? "bg-destructive/10 hover:bg-destructive/15" : "bg-warning/10 hover:bg-warning/15"}
                >
                  <TableCell>
                    <Link to="/students/$id" params={{ id: r.studentId }} className="font-medium text-primary">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>الصف {r.gradeId}</TableCell>
                  <TableCell className="font-mono">{r.dueDate}</TableCell>
                  <TableCell className="font-mono font-semibold">{formatMoney(r.amount, "SYP")}</TableCell>
                  <TableCell>
                    {r.status === "late" ? (
                      <Badge variant="destructive">متأخر {r.days} يوم</Badge>
                    ) : (
                      <Badge className="bg-warning text-warning-foreground">بعد {r.days} يوم</Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
