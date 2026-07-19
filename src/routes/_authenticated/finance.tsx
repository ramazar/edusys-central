import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/finance")({ component: FinancePage });

function FinancePage() {
  const qc = useQueryClient();
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const { data: income = [] } = useQuery({
    queryKey: ["income"],
    queryFn: async () => (await supabase.from("income_entries").select("*").order("entry_date", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("entry_date", { ascending: false }).limit(200)).data ?? [],
  });

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
        <TabsList><TabsTrigger value="income">الإيرادات</TabsTrigger><TabsTrigger value="expenses">المصروفات</TabsTrigger></TabsList>
        <TabsContent value="income" className="space-y-3">
          <Button onClick={() => setIncomeOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة إيراد</Button>
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {income.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
              {income.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="font-mono text-success">{Number(r.amount).toLocaleString("ar")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="expenses" className="space-y-3">
          <Button onClick={() => setExpenseOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة مصروف</Button>
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {expenses.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد بيانات</TableCell></TableRow>}
              {expenses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="font-mono text-destructive">{Number(r.amount).toLocaleString("ar")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
      </Tabs>

      <EntryDialog kind="income" open={incomeOpen} onOpenChange={setIncomeOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["income"] })} />
      <EntryDialog kind="expense" open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />
    </div>
  );
}

function EntryDialog({ kind, open, onOpenChange, onSaved }: { kind: "income" | "expense"; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const table = kind === "income" ? "income_entries" : "expenses";
    const { data, error } = await supabase.from(table).insert({
      amount: Number(amount), category, description, entry_date: date, recorded_by: user?.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", table, data.id, null, data);
    toast.success("تم الحفظ"); onSaved(); onOpenChange(false);
    setAmount(""); setCategory(""); setDescription("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{kind === "income" ? "إضافة إيراد" : "إضافة مصروف"}</DialogTitle></DialogHeader>
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
