import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession, useMyAccess } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, AlertTriangle, CalendarCheck } from "lucide-react";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { type Currency, asCurrency, formatMoney } from "@/lib/currency";
import { fetchAll } from "@/lib/fetch-all";
import { monthRange } from "@/lib/finance-period";

const FinanceCharts = lazy(() => import("@/components/dashboard/FinanceCharts"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { data: access, isLoading: accessLoading } = useMyAccess(user?.id);
  const allowed = !!access && (access.isSuperAdmin || access.roles.some((r) => r === "admin" || r === "accountant"));

  const activeSchoolId = access?.activeSchoolId ?? null;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", activeSchoolId],
    enabled: !!activeSchoolId && allowed,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { from: monthStart, to: nextMonthStart } = monthRange(new Date());
      const [studentsC, teachersC, workersC, incomeM, expenseM, attToday, paymentsSum] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", activeSchoolId!).eq("is_active", true),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", activeSchoolId!).eq("is_active", true),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("school_id", activeSchoolId!).eq("is_active", true),
        fetchAll((from, to) => supabase.from("income_entries").select("amount,currency").eq("school_id", activeSchoolId!).gte("entry_date", monthStart).lt("entry_date", nextMonthStart).order("entry_date").range(from, to)),
        fetchAll((from, to) => supabase.from("expenses").select("amount,currency").eq("school_id", activeSchoolId!).gte("entry_date", monthStart).lt("entry_date", nextMonthStart).order("entry_date").range(from, to)),
        fetchAll((from, to) => supabase.from("attendance").select("status").eq("school_id", activeSchoolId!).eq("date", today).order("id").range(from, to)),
        fetchAll((from, to) => supabase.from("student_payments").select("amount,currency").eq("school_id", activeSchoolId!).gte("payment_date", monthStart).lt("payment_date", nextMonthStart).order("payment_date").range(from, to)),
      ]);
      const countError = studentsC.error ?? teachersC.error ?? workersC.error;
      if (countError) throw countError;
      // Currencies are never converted: SYP and USD are totalled separately.
      const sumBy = (rows: { amount: number | string; currency: unknown }[], c: Currency) =>
        rows.filter((r) => asCurrency(r.currency) === c).reduce((s, r) => s + Number(r.amount), 0);
      const incomeRows = [...incomeM, ...paymentsSum];
      const incomeTotal = sumBy(incomeRows, "SYP");
      const incomeTotalUsd = sumBy(incomeRows, "USD");
      const expenseTotal = sumBy(expenseM, "SYP");
      const expenseTotalUsd = sumBy(expenseM, "USD");
      const presentToday = attToday.filter((r) => r.status === "present").length;
      const rate = attToday.length ? Math.round((presentToday / attToday.length) * 100) : 0;
      return {
        students: studentsC.count ?? 0,
        teachers: teachersC.count ?? 0,
        workers: workersC.count ?? 0,
        incomeTotal,
        incomeTotalUsd,
        expenseTotal,
        expenseTotalUsd,
        net: incomeTotal - expenseTotal,
        attendanceRate: rate,
      };
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ["monthly-finance", activeSchoolId],
    enabled: !!activeSchoolId && allowed,
    queryFn: async () => {
      const start = startOfMonth(subMonths(new Date(), 5)).toISOString().slice(0, 10);
      const end = addMonths(startOfMonth(new Date()), 1).toISOString().slice(0, 10);
      // Chart shows SYP only; mixing currencies in one bar would be meaningless.
      const [inc, pay, exp] = await Promise.all([
        fetchAll((from, to) => supabase.from("income_entries").select("amount,entry_date").eq("school_id", activeSchoolId!).eq("currency", "SYP").gte("entry_date", start).lt("entry_date", end).order("entry_date").range(from, to)),
        fetchAll((from, to) => supabase.from("student_payments").select("amount,payment_date").eq("school_id", activeSchoolId!).eq("currency", "SYP").gte("payment_date", start).lt("payment_date", end).order("payment_date").range(from, to)),
        fetchAll((from, to) => supabase.from("expenses").select("amount,entry_date").eq("school_id", activeSchoolId!).eq("currency", "SYP").gte("entry_date", start).lt("entry_date", end).order("entry_date").range(from, to)),
      ]);
      const buckets = new Map<string, { month: string; income: number; expense: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(startOfMonth(d), "yyyy-MM");
        buckets.set(key, { month: format(d, "MMM"), income: 0, expense: 0 });
      }
      const bucketKey = (dateStr: string) => dateStr.slice(0, 7);
      for (const r of inc) {
        const b = buckets.get(bucketKey(r.entry_date));
        if (b) b.income += Number(r.amount);
      }
      for (const r of pay) {
        const b = buckets.get(bucketKey(r.payment_date));
        if (b) b.income += Number(r.amount);
      }
      for (const r of exp) {
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
    {
      title: "الإيرادات هذا الشهر",
      value: formatMoney(stats?.incomeTotal ?? 0, "SYP"),
      extra: (stats?.incomeTotalUsd ?? 0) > 0 ? formatMoney(stats?.incomeTotalUsd ?? 0, "USD") : null,
      icon: Wallet,
      tone: "text-success",
    },
    {
      title: "المصروفات هذا الشهر",
      value: formatMoney(stats?.expenseTotal ?? 0, "SYP"),
      extra: (stats?.expenseTotalUsd ?? 0) > 0 ? formatMoney(stats?.expenseTotalUsd ?? 0, "USD") : null,
      icon: AlertTriangle,
      tone: "text-destructive",
    },
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
              {"extra" in k && k.extra && <div className="mt-1 text-xs text-muted-foreground">و{k.extra}</div>}
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
