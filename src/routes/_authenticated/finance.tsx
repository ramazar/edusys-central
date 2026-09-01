import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";

type Entry = {
  id: string;
  amount: number;
  entry_date: string;
  category: string | null;
  description: string | null;
};

const PaymentDues = lazy(() => import("@/components/finance/PaymentDues"));

export const Route = createFileRoute("/_authenticated/finance")({ component: FinancePage });

function FinancePage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<{ kind: "income" | "expense"; entry: Entry } | null>(null);

  const { data: income = [] } = useQuery({
    queryKey: ["income"],
    queryFn: async () => ((await supabase.from("income_entries").select("*").order("entry_date", { ascending: false }).limit(200)).data ?? []) as Entry[],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => ((await supabase.from("expenses").select("*").order("entry_date", { ascending: false }).limit(200)).data ?? []) as Entry[],
  });

  const removeEntry = async (kind: "income" | "expense", entry: Entry) => {
    const label = kind === "income" ? "الإيراد" : "المصروف";
    if (!confirm(`حذف ${label} بمبلغ ${Number(entry.amount).toLocaleString("ar")}؟ لا يمكن التراجع.`)) return;
    const table = kind === "income" ? "income_entries" : "expenses";
    const { error } = await supabase.from(table).delete().eq("id", entry.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", table, entry.id, entry, null);
    toast.success(`تم حذف ${label}`);
    qc.invalidateQueries({ queryKey: [kind === "income" ? "income" : "expenses"] });
  };

  const rowActions = (kind: "income" | "expense", entry: Entry) =>
    canManage ? (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setEditing({ kind, entry })}><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="destructive" onClick={() => removeEntry(kind, entry)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    );


  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">المالية</h1>
        <p className="text-sm text-muted-foreground">الإيرادات والمصروفات</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">إجمالي الإيرادات</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{totalIncome.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">إجمالي المصروفات</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{totalExpense.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">الصافي</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>{net.toLocaleString("ar")}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="income">
        <TabsList><TabsTrigger value="income">الإيرادات</TabsTrigger><TabsTrigger value="expenses">المصروفات</TabsTrigger><TabsTrigger value="dues">المتأخرات والاستحقاقات</TabsTrigger></TabsList>
        <TabsContent value="dues">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-card" />}>
            <PaymentDues />
          </Suspense>
        </TabsContent>
        <TabsContent value="income" className="space-y-3">
          {canManage && <Button onClick={() => setIncomeOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة إيراد</Button>}
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {income.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
              {income.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="font-mono text-success">{Number(r.amount).toLocaleString("ar")}</TableCell>
                  <TableCell>{rowActions("income", r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="expenses" className="space-y-3">
          {canManage && <Button onClick={() => setExpenseOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة مصروف</Button>}
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
              {expenses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="font-mono text-destructive">{Number(r.amount).toLocaleString("ar")}</TableCell>
                  <TableCell>{rowActions("expense", r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
      </Tabs>

      <EntryDialog kind="income" open={incomeOpen} onOpenChange={setIncomeOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["income"] })} />
      <EntryDialog kind="expense" open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />
      {editing && (
        <EntryDialog
          key={editing.entry.id}
          kind={editing.kind}
          entry={editing.entry}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: [editing.kind === "income" ? "income" : "expenses"] })}
        />
      )}
    </div>
  );
}

function EntryDialog({ kind, entry, open, onOpenChange, onSaved }: { kind: "income" | "expense"; entry?: Entry; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [date, setDate] = useState(entry?.entry_date ?? new Date().toISOString().slice(0, 10));

  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const table = kind === "income" ? "income_entries" : "expenses";
    const values = { amount: Number(amount), category, description, entry_date: date };
    if (entry) {
      const { data, error } = await supabase.from(table).update(values).eq("id", entry.id).select().single();
      if (error) return toast.error(error.message);
      await logAudit(user, "update", table, entry.id, entry, data);
      toast.success("تم تحديث القيد"); onSaved(); onOpenChange(false);
      return;
    }
    const { data, error } = await supabase.from(table).insert({ ...values, recorded_by: user?.id }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", table, data.id, null, data);
    toast.success("تم الحفظ"); onSaved(); onOpenChange(false);
    setAmount(""); setCategory(""); setDescription("");
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
          <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
