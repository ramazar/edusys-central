import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession, useMyAccess } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, AlertTriangle, CalendarCheck } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

const FinanceCharts = lazy(() => import("@/components/dashboard/FinanceCharts"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { data: access, isLoading: accessLoading } = useMyAccess(user?.id);
  const allowed = !!access && (access.isSuperAdmin || access.roles.some((r) => r === "admin" || r === "accountant"));

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
      const start = startOfMonth(subMonths(new Date(), 5)).toISOString().slice(0, 10);
      const [inc, pay, exp] = await Promise.all([
        supabase.from("income_entries").select("amount,entry_date").gte("entry_date", start),
        supabase.from("student_payments").select("amount,payment_date").gte("payment_date", start),
        supabase.from("expenses").select("amount,entry_date").gte("entry_date", start),
      ]);
      const buckets = new Map<string, { month: string; income: number; expense: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(startOfMonth(d), "yyyy-MM");
        buckets.set(key, { month: format(d, "MMM"), income: 0, expense: 0 });
      }
      const bucketKey = (dateStr: string) => dateStr.slice(0, 7);
      for (const r of inc.data ?? []) {
        const b = buckets.get(bucketKey(r.entry_date));
        if (b) b.income += Number(r.amount);
      }
      for (const r of pay.data ?? []) {
        const b = buckets.get(bucketKey(r.payment_date));
        if (b) b.income += Number(r.amount);
      }
      for (const r of exp.data ?? []) {
        const b = buckets.get(bucketKey(r.entry_date));
        if (b) b.expense += Number(r.amount);
      }
      return Array.from(buckets.values());
    },
  });

  useEffect(() => {
    if (!accessLoading && access && !allowed) navigate({ to: "/students", search: {} as never, replace: true });
  }, [accessLoading, access, allowed, navigate]);

  const kpis = [
    { title: "إجمالي الطلاب", value: stats?.students ?? "—", icon: Users, tone: "text-primary" },
    { title: "الإيرادات هذا الشهر", value: `${(stats?.incomeTotal ?? 0).toLocaleString("ar")} `, icon: Wallet, tone: "text-success" },
    { title: "المصروفات هذا الشهر", value: `${(stats?.expenseTotal ?? 0).toLocaleString("ar")} `, icon: AlertTriangle, tone: "text-destructive" },
    { title: "معدل الحضور اليوم", value: `${stats?.attendanceRate ?? 0}%`, icon: CalendarCheck, tone: "text-primary" },
  ];

  if (!allowed) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        {accessLoading ? "جارٍ التحميل..." : "لوحة التحكم متاحة لمدير النظام والمحاسب فقط"}
      </div>
    );
  }

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

      <Suspense fallback={<div className="h-72 rounded-lg border bg-card animate-pulse" />}>
        <FinanceCharts monthly={monthly ?? []} />
      </Suspense>
    </div>
  );
}
