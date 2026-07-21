import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, History, Trash2, ScanLine, LogIn, LogOut, Pencil } from "lucide-react";
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
  attendance_code: string | null;
  due_override: number | null;
};

type AttendanceRow = {
  id: string;
  teacher_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
};

function monthsBetween(from: string) {
  const start = new Date(from);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

const today = () => new Date().toISOString().slice(0, 10);

function TeachersPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const canScan = hasAny(roles, ["admin", "accountant", "reception"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Teacher | null>(null);
  const [editOpen, setEditOpen] = useState<Teacher | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").order("full_name");
      return (data ?? []) as unknown as Teacher[];
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

  const { data: todayAtt = [] } = useQuery({
    queryKey: ["teacher_attendance_today"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("teacher_attendance").select("*").eq("date", today());
      return (data ?? []) as AttendanceRow[];
    },
  });

  const attByTeacher: Record<string, AttendanceRow> = {};
  todayAtt.forEach((r) => (attByTeacher[r.teacher_id] = r));

  const totalPaid = Object.values(paymentsByTeacher).reduce((s, v) => s + v, 0);
  const totalDue = teachers.reduce((s, t) => s + (t.due_override != null ? Number(t.due_override) : Number(t.salary_amount) * monthsBetween(t.hire_date)), 0);
  const totalRemaining = totalDue - totalPaid;

  const submitCode = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    const teacher = teachers.find((t) => (t.attendance_code || "").trim() === c);
    if (!teacher) {
      toast.error("رمز غير معروف");
      setCode("");
      codeRef.current?.focus();
      return;
    }
    const existing = attByTeacher[teacher.id];
    const now = new Date().toISOString();
    if (!existing) {
      const { error } = await (supabase as any).from("teacher_attendance").insert({
        teacher_id: teacher.id, date: today(), check_in: now, recorded_by: user?.id,
      });
      if (error) { toast.error(error.message); return; }
      await logAudit(user, "check_in", "teacher_attendance", teacher.id, null, { check_in: now });
      toast.success(`تم تسجيل حضور ${teacher.full_name} — ${fmtTime(now)}`);
    } else if (!existing.check_out) {
      const { error } = await (supabase as any).from("teacher_attendance").update({ check_out: now }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit(user, "check_out", "teacher_attendance", teacher.id, null, { check_out: now });
      toast.success(`تم تسجيل انصراف ${teacher.full_name} — ${fmtTime(now)}`);
    } else {
      toast.info(`${teacher.full_name} سجّل حضوره وانصرافه اليوم`);
    }
    setCode("");
    codeRef.current?.focus();
    qc.invalidateQueries({ queryKey: ["teacher_attendance_today"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المعلمون</h1>
          <p className="text-sm text-muted-foreground">حضور المعلمين بالرمز، وسجل الرواتب</p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة معلم</Button>}
      </div>

      {canScan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ScanLine className="h-5 w-5" /> تسجيل الحضور والانصراف بالرمز</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); submitCode(code); }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[220px]">
                <Label>امسح الباركود أو أدخل الرمز</Label>
                <Input
                  ref={codeRef}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: 123456"
                  className="mt-1 font-mono text-lg tracking-widest"
                  dir="ltr"
                />
              </div>
              <Button type="submit" size="lg">تسجيل</Button>
              <p className="text-xs text-muted-foreground">أول مسح = حضور، والمسح التالي في نفس اليوم = انصراف.</p>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي المستحق</div><div className="text-2xl font-bold">{totalDue.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي المدفوع</div><div className="text-2xl font-bold text-success">{totalPaid.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">الرصيد المتبقي</div><div className={`text-2xl font-bold ${totalRemaining > 0 ? "text-destructive" : "text-success"}`}>{totalRemaining.toLocaleString("ar")}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">التخصص</TableHead>
          <TableHead className="text-right">الرمز</TableHead>
          <TableHead className="text-right">حضور اليوم</TableHead>
          <TableHead className="text-right">انصراف اليوم</TableHead>
          <TableHead className="text-right">الراتب</TableHead>
          <TableHead className="text-right">المستحق</TableHead>
          <TableHead className="text-right">المدفوع</TableHead>
          <TableHead className="text-right">المتبقي</TableHead>
          <TableHead className="text-right">إجراءات</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {teachers.length === 0 && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">لا يوجد معلمون</TableCell></TableRow>}
          {teachers.map((t) => {
            const paid = paymentsByTeacher[t.id] ?? 0;
            const due = t.due_override != null ? Number(t.due_override) : Number(t.salary_amount) * monthsBetween(t.hire_date);
            const remaining = due - paid;
            const att = attByTeacher[t.id];
            return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.full_name}</TableCell>
                <TableCell>{(t.subjects || []).join("، ") || "—"}</TableCell>
                <TableCell className="font-mono" dir="ltr">{t.attendance_code || "—"}</TableCell>
                <TableCell>
                  {att?.check_in
                    ? <Badge className="bg-success text-success-foreground gap-1"><LogIn className="h-3 w-3" />{fmtTime(att.check_in)}</Badge>
                    : <Badge variant="secondary">لم يحضر</Badge>}
                </TableCell>
                <TableCell>
                  {att?.check_out
                    ? <Badge className="gap-1" variant="outline"><LogOut className="h-3 w-3" />{fmtTime(att.check_out)}</Badge>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="font-mono">{Number(t.salary_amount || 0).toLocaleString("ar")}</TableCell>
                <TableCell className="font-mono">
                  <span className={t.due_override != null ? "text-primary font-semibold" : ""}>{due.toLocaleString("ar")}</span>
                  {t.due_override != null && <span className="ms-1 text-[10px] text-muted-foreground">(مخصص)</span>}
                </TableCell>
                <TableCell className="font-mono text-success">{paid.toLocaleString("ar")}</TableCell>
                <TableCell className={`font-mono ${remaining > 0 ? "text-destructive" : "text-success"}`}>{remaining.toLocaleString("ar")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setHistoryOpen(t)}><History className="ml-1 h-4 w-4" /> السجل</Button>
                    {canManage && <Button size="sm" variant="outline" onClick={() => setEditOpen(t)}><Pencil className="ml-1 h-4 w-4" /> تعديل</Button>}
                    {canManage && <Button size="sm" onClick={() => setPayOpen(t.id)}><DollarSign className="ml-1 h-4 w-4" /> صرف</Button>}
                    {canManage && (
                      <Button size="sm" variant="destructive" onClick={async () => {
                        if (!confirm(`حذف المعلم ${t.full_name}؟ سيتم حذف كل سجلات رواتبه وحضوره.`)) return;
                        const { error } = await supabase.from("teachers").delete().eq("id", t.id);
                        if (error) return toast.error(error.message);
                        await logAudit(user, "delete", "teachers", t.id, t, null);
                        toast.success("تم حذف المعلم");
                        qc.invalidateQueries({ queryKey: ["teachers"] });
                        qc.invalidateQueries({ queryKey: ["teacher_payments_all"] });
                        qc.invalidateQueries({ queryKey: ["teacher_attendance_today"] });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    )}
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

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function TeacherDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "", salary_amount: 0, attendance_code: randomCode() });
  const save = async () => {
    if (!form.full_name) return toast.error("الاسم مطلوب");
    const { specialty, ...rest } = form;
    const payload = { ...rest, subjects: specialty ? [specialty] : [] };
    const { data, error } = await supabase.from("teachers").insert(payload as never).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "teachers", data.id, null, data);
    toast.success("تم إضافة المعلم"); onSaved(); onOpenChange(false);
    setForm({ full_name: "", specialty: "", phone: "", email: "", salary_amount: 0, attendance_code: randomCode() });
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
          <div>
            <Label>رمز الحضور</Label>
            <div className="flex gap-2">
              <Input dir="ltr" className="font-mono" value={form.attendance_code} onChange={(e) => setForm({ ...form, attendance_code: e.target.value })} />
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, attendance_code: randomCode() })}>توليد</Button>
            </div>
          </div>
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
