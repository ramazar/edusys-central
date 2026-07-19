import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, AlertTriangle, CalendarCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, LineChart } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [studentsC, teachersC, workersC, incomeM, expenseM, attToday, paymentsSum] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("income_entries").select("amount").gte("entry_date", startOfMonth(new Date()).toISOString().slice(0, 10)),
        supabase.from("expenses").select("amount").gte("entry_date", startOfMonth(new Date()).toISOString().slice(0, 10)),
        supabase.from("attendance").select("status").eq("date", today),
        supabase.from("student_payments").select("amount").gte("payment_date", startOfMonth(new Date()).toISOString().slice(0, 10)),
      ]);
      const incomeTotal = (incomeM.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
        + (paymentsSum.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const expenseTotal = (expenseM.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const presentToday = (attToday.data ?? []).filter((r) => r.status === "present").length;
      const totalAttToday = (attToday.data ?? []).length;
      const rate = totalAttToday ? Math.round((presentToday / totalAttToday) * 100) : 0;
      return {
        students: studentsC.count ?? 0,
        teachers: teachersC.count ?? 0,
        workers: workersC.count ?? 0,
        incomeTotal,
        expenseTotal,
        net: incomeTotal - expenseTotal,
        attendanceRate: rate,
      };
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ["monthly-finance"],
    queryFn: async () => {
      const rows: { month: string; income: number; expense: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const from = startOfMonth(subMonths(new Date(), i)).toISOString().slice(0, 10);
        const to = startOfMonth(subMonths(new Date(), i - 1)).toISOString().slice(0, 10);
        const [inc, pay, exp] = await Promise.all([
          supabase.from("income_entries").select("amount").gte("entry_date", from).lt("entry_date", to),
          supabase.from("student_payments").select("amount").gte("payment_date", from).lt("payment_date", to),
          supabase.from("expenses").select("amount").gte("entry_date", from).lt("entry_date", to),
        ]);
        rows.push({
          month: format(subMonths(new Date(), i), "MMM"),
          income:
            (inc.data ?? []).reduce((s, r) => s + Number(r.amount), 0) +
            (pay.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
          expense: (exp.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
        });
      }
      return rows;
    },
  });

  const kpis = [
    { title: "إجمالي الطلاب", value: stats?.students ?? "—", icon: Users, tone: "text-primary" },
    { title: "الإيرادات هذا الشهر", value: `${(stats?.incomeTotal ?? 0).toLocaleString("ar")} `, icon: Wallet, tone: "text-success" },
    { title: "المصروفات هذا الشهر", value: `${(stats?.expenseTotal ?? 0).toLocaleString("ar")} `, icon: AlertTriangle, tone: "text-destructive" },
    { title: "معدل الحضور اليوم", value: `${stats?.attendanceRate ?? 0}%`, icon: CalendarCheck, tone: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على أداء المدرسة</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.title}</CardTitle>
              <k.icon className={`h-5 w-5 ${k.tone}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الإيرادات مقابل المصروفات</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" reversed />
                <YAxis orientation="right" />
                <Tooltip />
                <Bar dataKey="income" fill="oklch(0.65 0.16 155)" name="إيرادات" />
                <Bar dataKey="expense" fill="oklch(0.585 0.22 27)" name="مصروفات" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>صافي الربح الشهري</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(monthly ?? []).map(m => ({ month: m.month, net: m.income - m.expense }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" reversed />
                <YAxis orientation="right" />
                <Tooltip />
                <Line type="monotone" dataKey="net" stroke="oklch(0.478 0.203 262)" strokeWidth={2} name="الصافي" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
