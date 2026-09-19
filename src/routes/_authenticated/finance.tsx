import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, useMyAccess, hasAny, logAudit } from "@/hooks/useAuth";
import { CURRENCIES, type Currency, asCurrency, currencyLabel, currencyName, formatMoney } from "@/lib/currency";

type Entry = {
  id: string;
  amount: number;
  entry_date: string;
  category: string | null;
  description: string | null;
  currency: Currency;
  school_id: string | null;
};

/** A row shown in the finance tables: either a manual entry or a linked payment (read-only). */
type Row = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: Currency;
  source: "manual" | "student" | "teacher" | "worker";
  entry?: Entry;
};

const sourceLabel: Record<Row["source"], string> = {
  manual: "قيد يدوي",
  student: "دفعة طالب",
  teacher: "راتب معلم",
  worker: "راتب عامل",
};

const PaymentDues = lazy(() => import("@/components/finance/PaymentDues"));

export const Route = createFileRoute("/_authenticated/finance")({ component: FinancePage });

function FinancePage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const { data: access } = useMyAccess(user?.id);
  const activeSchoolId = access?.activeSchoolId ?? null;
  const [currency, setCurrency] = useState<Currency>("SYP");
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<{ kind: "income" | "expense"; entry: Entry } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [resetAmount, setResetAmount] = useState<number | null>(null);

  const { data: incomeRows = [] } = useQuery({
    queryKey: ["finance-income"],
    queryFn: async (): Promise<Row[]> => {
      const [entriesRes, paymentsRes] = await Promise.all([
        supabase.from("income_entries").select("*").order("entry_date", { ascending: false }).limit(200),
        supabase
          .from("student_payments")
          .select("id, amount, payment_date, method, notes, currency, students(full_name)")
          .order("payment_date", { ascending: false })
          .limit(300),
      ]);
      const manual: Row[] = (entriesRes.data ?? []).map((r) => {
        const entry: Entry = {
          id: r.id,
          amount: Number(r.amount),
          entry_date: r.entry_date,
          category: r.category,
          description: r.description,
          currency: asCurrency(r.currency),
          school_id: (r as { school_id?: string | null }).school_id ?? null,
        };
        return {
          id: r.id,
          date: r.entry_date,
          category: r.category || "—",
          description: r.description || "—",
          amount: entry.amount,
          currency: entry.currency,
          source: "manual",
          entry,
        };
      });
      const linked: Row[] = (paymentsRes.data ?? []).map((p) => ({
        id: p.id,
        date: p.payment_date,
        category: "أقساط الطلاب",
        description: [(p.students as { full_name: string } | null)?.full_name, p.method, p.notes].filter(Boolean).join(" — ") || "—",
        amount: Number(p.amount),
        currency: asCurrency(p.currency),
        source: "student",
      }));
      return [...manual, ...linked].sort((a, b) => b.date.localeCompare(a.date));
    },
  });

  const { data: expenseRows = [] } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async (): Promise<Row[]> => {
      const [entriesRes, teacherRes, workerRes] = await Promise.all([
        supabase.from("expenses").select("*").order("entry_date", { ascending: false }).limit(200),
        supabase
          .from("teacher_payments")
          .select("id, amount, payment_date, notes, currency, teachers(full_name)")
          .order("payment_date", { ascending: false })
          .limit(300),
        supabase
          .from("worker_payments")
          .select("id, amount, payment_date, notes, currency, workers(full_name)")
          .order("payment_date", { ascending: false })
          .limit(300),
      ]);
      const manual: Row[] = (entriesRes.data ?? []).map((r) => {
        const entry: Entry = {
          id: r.id,
          amount: Number(r.amount),
          entry_date: r.entry_date,
          category: r.category,
          description: r.description,
          currency: asCurrency(r.currency),
          school_id: (r as { school_id?: string | null }).school_id ?? null,
        };
        return {
          id: r.id,
          date: r.entry_date,
          category: r.category || "—",
          description: r.description || "—",
          amount: entry.amount,
          currency: entry.currency,
          source: "manual",
          entry,
        };
      });
      const teacherRows: Row[] = (teacherRes.data ?? []).map((p) => ({
        id: p.id,
        date: p.payment_date,
        category: "رواتب المعلمين",
        description: [(p.teachers as { full_name: string } | null)?.full_name, p.notes].filter(Boolean).join(" — ") || "—",
        amount: Number(p.amount),
        currency: asCurrency(p.currency),
        source: "teacher",
      }));
      const workerRows: Row[] = (workerRes.data ?? []).map((p) => ({
        id: p.id,
        date: p.payment_date,
        category: "رواتب العمال",
        description: [(p.workers as { full_name: string } | null)?.full_name, p.notes].filter(Boolean).join(" — ") || "—",
        amount: Number(p.amount),
        currency: asCurrency(p.currency),
        source: "worker",
      }));
      return [...manual, ...teacherRows, ...workerRows].sort((a, b) => b.date.localeCompare(a.date));
    },
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["vault-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_withdrawals")
        .select("*")
        .order("withdrawn_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const removeWithdrawal = async (id: string, amount: number, cur: Currency) => {
    if (!confirm(`حذف سحب بمبلغ ${formatMoney(amount, cur)}؟ سيعود المبلغ إلى الصندوق.`)) return;
    const { error } = await supabase.from("vault_withdrawals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "vault_withdrawals", id, { amount, currency: cur }, null);
    toast.success("تم حذف السحب");
    qc.invalidateQueries({ queryKey: ["vault-withdrawals"] });
  };

  const removeEntry = async (kind: "income" | "expense", entry: Entry) => {
    const label = kind === "income" ? "الإيراد" : "المصروف";
    if (!confirm(`حذف ${label} بمبلغ ${formatMoney(entry.amount, entry.currency)}؟ لا يمكن التراجع.`)) return;
    const table = kind === "income" ? "income_entries" : "expenses";
    const { error } = await supabase.from(table).delete().eq("id", entry.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", table, entry.id, entry, null);
    toast.success(`تم حذف ${label}`);
    qc.invalidateQueries({ queryKey: [kind === "income" ? "finance-income" : "finance-expenses"] });
  };

  const rowActions = (kind: "income" | "expense", row: Row) => {
    if (row.source !== "manual" || !row.entry) {
      return <span className="text-xs text-muted-foreground">يُدار من صفحته</span>;
    }
    if (!canManage) return <span className="text-muted-foreground">—</span>;
    const entry = row.entry;
    if (entry.school_id && activeSchoolId && entry.school_id !== activeSchoolId) {
      return <span className="text-xs text-muted-foreground">مدرسة أخرى</span>;
    }
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setEditing({ kind, entry })}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="destructive" onClick={() => removeEntry(kind, entry)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    );
  };

  const income = incomeRows.filter((r) => r.currency === currency);
  const expenses = expenseRows.filter((r) => r.currency === currency);
  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const net = totalIncome - totalExpense;
  const currencyWithdrawals = withdrawals.filter((w) => asCurrency(w.currency) === currency);
  const totalWithdrawn = currencyWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const vaultBalance = totalIncome - totalExpense - totalWithdrawn;

  const table = (kind: "income" | "expense", rows: Row[]) => (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead className="text-right">التاريخ</TableHead>
        <TableHead className="text-right">الفئة</TableHead>
        <TableHead className="text-right">الوصف</TableHead>
        <TableHead className="text-right">المصدر</TableHead>
        <TableHead className="text-right">المبلغ</TableHead>
        <TableHead className="text-right">إجراءات</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد بيانات بـ{currencyName[currency]}</TableCell></TableRow>}
        {rows.map((r) => (
          <TableRow key={`${r.source}-${r.id}`}>
            <TableCell>{r.date}</TableCell>
            <TableCell>{r.category}</TableCell>
            <TableCell>{r.description}</TableCell>
            <TableCell>
              <Badge variant={r.source === "manual" ? "outline" : "secondary"}>{sourceLabel[r.source]}</Badge>
            </TableCell>
            <TableCell className={`font-mono ${kind === "income" ? "text-success" : "text-destructive"}`}>{formatMoney(r.amount, r.currency)}</TableCell>
            <TableCell>{rowActions(kind, r)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المالية</h1>
          <p className="text-sm text-muted-foreground">الإيرادات والمصروفات — مدفوعات الطلاب والرواتب مرتبطة تلقائياً</p>
        </div>
        <Tabs value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
          <TabsList>
            {CURRENCIES.map((c) => (
              <TabsTrigger key={c} value={c}>{currencyName[c]} ({currencyLabel[c]})</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">إجمالي الإيرادات</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{formatMoney(totalIncome, currency)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">إجمالي المصروفات</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{formatMoney(totalExpense, currency)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">الصافي</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(net, currency)}</div></CardContent></Card>
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">النقد في الصندوق</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${vaultBalance >= 0 ? "text-primary" : "text-destructive"}`}>{formatMoney(vaultBalance, currency)}</div>
            <p className="mt-1 text-xs text-muted-foreground">المسحوب: {formatMoney(totalWithdrawn, currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="income">
        <TabsList><TabsTrigger value="income">الإيرادات</TabsTrigger><TabsTrigger value="expenses">المصروفات</TabsTrigger><TabsTrigger value="vault">الصندوق</TabsTrigger><TabsTrigger value="dues">المتأخرات والاستحقاقات</TabsTrigger></TabsList>
        <TabsContent value="vault" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">النقد المتوفر في الصندوق ({currencyName[currency]})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold text-primary">{formatMoney(vaultBalance, currency)}</div>
              <p className="text-sm text-muted-foreground">يُحسب من الإيرادات ناقص المصروفات ناقص ما سحبه المالك — وهو مستقل عن إجمالي الإيرادات.</p>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setWithdrawOpen(true)}><Plus className="ml-2 h-4 w-4" /> تسجيل سحب</Button>
                  <Button variant="outline" disabled={vaultBalance <= 0} onClick={() => setResetAmount(vaultBalance)}>تصفير الصندوق (سحب الكل)</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الملاحظات</TableHead>
              <TableHead className="text-right">المبلغ المسحوب</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {currencyWithdrawals.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد مسحوبات بـ{currencyName[currency]}</TableCell></TableRow>}
              {currencyWithdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.withdrawn_at}</TableCell>
                  <TableCell>{w.notes || "—"}</TableCell>
                  <TableCell className="font-mono">{formatMoney(Number(w.amount), asCurrency(w.currency))}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Button size="sm" variant="destructive" onClick={() => removeWithdrawal(w.id, Number(w.amount), asCurrency(w.currency))}><Trash2 className="h-4 w-4" /></Button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="dues">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-card" />}>
            <PaymentDues />
          </Suspense>
        </TabsContent>
        <TabsContent value="income" className="space-y-3">
          {canManage && <Button onClick={() => setIncomeOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة إيراد</Button>}
          {table("income", income)}
        </TabsContent>
        <TabsContent value="expenses" className="space-y-3">
          {canManage && <Button onClick={() => setExpenseOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة مصروف</Button>}
          {table("expense", expenses)}
        </TabsContent>
      </Tabs>

      <EntryDialog kind="income" defaultCurrency={currency} open={incomeOpen} onOpenChange={setIncomeOpen} onSaved={(c) => { setCurrency(c); qc.invalidateQueries({ queryKey: ["finance-income"] }); }} />
      <EntryDialog kind="expense" defaultCurrency={currency} open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={(c) => { setCurrency(c); qc.invalidateQueries({ queryKey: ["finance-expenses"] }); }} />
      {editing && (
        <EntryDialog
          key={editing.entry.id}
          kind={editing.kind}
          entry={editing.entry}
          defaultCurrency={editing.entry.currency}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(c) => {
            setCurrency(c);
            qc.invalidateQueries({ queryKey: [editing.kind === "income" ? "finance-income" : "finance-expenses"] });
          }}
        />
      )}
      <WithdrawDialog
        key={resetAmount ?? "manual"}
        open={withdrawOpen || resetAmount !== null}
        prefill={resetAmount}
        defaultCurrency={currency}
        onOpenChange={(o) => { if (!o) { setWithdrawOpen(false); setResetAmount(null); } }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["vault-withdrawals"] })}
      />
    </div>
  );
}

function WithdrawDialog({ open, prefill, defaultCurrency, onOpenChange, onSaved }: { open: boolean; prefill: number | null; defaultCurrency: Currency; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState(prefill != null ? String(prefill) : "");
  const [notes, setNotes] = useState(prefill != null ? "تصفير الصندوق" : "");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const save = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("المبلغ مطلوب");
    const { data, error } = await supabase
      .from("vault_withdrawals")
      .insert({ amount: Number(amount), currency, withdrawn_at: date, notes, recorded_by: user?.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "vault_withdrawals", data.id, null, data);
    toast.success("تم تسجيل السحب من الصندوق");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>سحب من الصندوق</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>العملة</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyName[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({ kind, entry, defaultCurrency, open, onOpenChange, onSaved }: { kind: "income" | "expense"; entry?: Entry; defaultCurrency: Currency; open: boolean; onOpenChange: (v: boolean) => void; onSaved: (savedCurrency: Currency) => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency);
  const [date, setDate] = useState(entry?.entry_date ?? new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!amount || Number.isNaN(Number(amount))) return toast.error("المبلغ مطلوب");
    setSaving(true);
    try {
      const table = kind === "income" ? "income_entries" : "expenses";
      const values = { amount: Number(amount), category, description, entry_date: date, currency };
      if (entry) {
        const { data, error } = await supabase.from(table).update(values).eq("id", entry.id).select().maybeSingle();
        if (error) return toast.error(error.message);
        if (!data) return toast.error("لم يتم التحديث — لا تملك صلاحية تعديل هذا القيد أو أنه حُذف");
        await logAudit(user, "update", table, entry.id, entry, data);
        toast.success("تم تحديث القيد"); onSaved(currency); onOpenChange(false);
        return;
      }
      const { data, error } = await supabase.from(table).insert({ ...values, recorded_by: user?.id }).select().maybeSingle();
      if (error) return toast.error(error.message);
      if (!data) return toast.error("لم يتم الحفظ — تحقق من الصلاحيات");
      await logAudit(user, "create", table, data.id, null, data);
      toast.success("تم الحفظ"); onSaved(currency); onOpenChange(false);
      setAmount(""); setCategory(""); setDescription("");
    } finally {
      setSaving(false);
    }
  };
  const title = entry
    ? kind === "income" ? "تعديل إيراد" : "تعديل مصروف"
    : kind === "income" ? "إضافة إيراد" : "إضافة مصروف";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الفئة</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><Label>الوصف</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>العملة</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyName[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
