import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/teachers")({ component: TeachersPage });

type Teacher = {
  id: string;
  full_name: string;
  subjects: string[] | null;
  phone: string | null;
  email: string | null;
  salary_amount: number;
  hire_date: string;
  is_active: boolean;
};

function monthsBetween(from: string) {
  const start = new Date(from);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
}

function TeachersPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Teacher | null>(null);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").order("full_name");
      return (data ?? []) as Teacher[];
    },
  });

  const { data: paymentsByTeacher = {} } = useQuery({
    queryKey: ["teacher_payments_all"],
    queryFn: async () => {
      const { data } = await supabase.from("teacher_payments").select("teacher_id, amount");
      const map: Record<string, number> = {};
      (data ?? []).forEach((p) => {
        map[p.teacher_id] = (map[p.teacher_id] ?? 0) + Number(p.amount);
      });
      return map;
    },
  });

  const totalPaid = Object.values(paymentsByTeacher).reduce((s, v) => s + v, 0);
  const totalDue = teachers.reduce((s, t) => s + Number(t.salary_amount) * monthsBetween(t.hire_date), 0);
  const totalRemaining = totalDue - totalPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المعلمون</h1>
          <p className="text-sm text-muted-foreground">قائمة المعلمين وسجل الرواتب</p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة معلم</Button>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي المستحق</div><div className="text-2xl font-bold">{totalDue.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي المدفوع</div><div className="text-2xl font-bold text-success">{totalPaid.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">الرصيد المتبقي</div><div className={`text-2xl font-bold ${totalRemaining > 0 ? "text-destructive" : "text-success"}`}>{totalRemaining.toLocaleString("ar")}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">التخصص</TableHead>
          <TableHead className="text-right">الراتب الشهري</TableHead>
          <TableHead className="text-right">المستحق</TableHead>
          <TableHead className="text-right">المدفوع</TableHead>
          <TableHead className="text-right">المتبقي</TableHead>
          <TableHead className="text-right">الحالة</TableHead>
          <TableHead className="text-right">إجراءات</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {teachers.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">لا يوجد معلمون</TableCell></TableRow>}
          {teachers.map((t) => {
            const paid = paymentsByTeacher[t.id] ?? 0;
            const due = Number(t.salary_amount) * monthsBetween(t.hire_date);
            const remaining = due - paid;
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.full_name}</TableCell>
                <TableCell>{(t.subjects || []).join("، ") || "—"}</TableCell>
                <TableCell className="font-mono">{Number(t.salary_amount || 0).toLocaleString("ar")}</TableCell>
                <TableCell className="font-mono">{due.toLocaleString("ar")}</TableCell>
                <TableCell className="font-mono text-success">{paid.toLocaleString("ar")}</TableCell>
                <TableCell className={`font-mono ${remaining > 0 ? "text-destructive" : "text-success"}`}>{remaining.toLocaleString("ar")}</TableCell>
                <TableCell>{t.is_active ? <Badge className="bg-success text-success-foreground">نشط</Badge> : <Badge variant="destructive">موقوف</Badge>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setHistoryOpen(t)}><History className="ml-1 h-4 w-4" /> السجل</Button>
                    {canManage && <Button size="sm" onClick={() => setPayOpen(t.id)}><DollarSign className="ml-1 h-4 w-4" /> صرف</Button>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table></CardContent></Card>

      <TeacherDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["teachers"] })} />
      {payOpen && <SalaryDialog teacherId={payOpen} onClose={() => setPayOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["teachers"] }); qc.invalidateQueries({ queryKey: ["teacher_payments_all"] }); }} />}
      {historyOpen && <HistoryDialog teacher={historyOpen} canManage={canManage} onClose={() => setHistoryOpen(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["teacher_payments_all"] })} />}
    </div>
  );
}

function TeacherDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "", salary_amount: 0 });
  const save = async () => {
    if (!form.full_name) return toast.error("الاسم مطلوب");
    const { specialty, ...rest } = form;
    const payload = { ...rest, subjects: specialty ? [specialty] : [] };
    const { data, error } = await supabase.from("teachers").insert(payload).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "teachers", data.id, null, data);
    toast.success("تم إضافة المعلم"); onSaved(); onOpenChange(false);
    setForm({ full_name: "", specialty: "", phone: "", email: "", salary_amount: 0 });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة معلم</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>الاسم</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>التخصص</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
          <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>البريد الإلكتروني</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>الراتب الشهري</Label><Input type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalaryDialog({ teacherId, onClose, onSaved }: { teacherId: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const { data, error } = await supabase.from("teacher_payments").insert({ teacher_id: teacherId, amount: Number(amount), payment_date: date, notes, recorded_by: user?.id }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "teacher_payments", data.id, null, data);
    toast.success("تم صرف الراتب"); onSaved(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>صرف راتب معلم</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ teacher, canManage, onClose, onChanged }: { teacher: Teacher; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuthSession();
  const qc = useQueryClient();
  const { data: payments = [] } = useQuery({
    queryKey: ["teacher_payments", teacher.id],
    queryFn: async () => {
      const { data } = await supabase.from("teacher_payments").select("*").eq("teacher_id", teacher.id).order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Number(teacher.salary_amount) * monthsBetween(teacher.hire_date);
  const remaining = due - paid;

  const remove = async (id: string, row: unknown) => {
    if (!confirm("حذف هذه الدفعة؟")) return;
    const { error } = await supabase.from("teacher_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "teacher_payments", id, row, null);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["teacher_payments", teacher.id] });
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>سجل رواتب — {teacher.full_name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">المستحق</div><div className="font-bold">{due.toLocaleString("ar")}</div></div>
          <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">المدفوع</div><div className="font-bold text-success">{paid.toLocaleString("ar")}</div></div>
          <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">المتبقي</div><div className={`font-bold ${remaining > 0 ? "text-destructive" : "text-success"}`}>{remaining.toLocaleString("ar")}</div></div>
        </div>
        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">ملاحظات</TableHead>
              {canManage && <TableHead className="text-right">حذف</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 && <TableRow><TableCell colSpan={canManage ? 4 : 3} className="py-6 text-center text-muted-foreground">لا مدفوعات</TableCell></TableRow>}
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell className="font-mono">{Number(p.amount).toLocaleString("ar")}</TableCell>
                  <TableCell>{p.notes || "—"}</TableCell>
                  {canManage && <TableCell><Button variant="ghost" size="icon" onClick={() => remove(p.id, p)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
