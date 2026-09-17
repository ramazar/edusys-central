import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, ArrowLeftRight, Printer, Plus, Trash2, Receipt, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, type Currency, asCurrency, currencyName, formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { generateInvoicePDF, generateReceiptPDF } from "@/lib/invoice";
import { generateStudentReport, buildStudentReportDoc } from "@/lib/student-report";
import { ExportMenu } from "@/components/ExportMenu";
import { StudentDialog } from "@/components/students/StudentDialog";
import { TransferStudentDialog } from "@/components/students/TransferStudentDialog";
import { deleteStudent } from "@/lib/students.functions";
import { gradeSectionLabel } from "@/lib/section-label";

type PaymentRow = {
  id: string;
  amount: number | string;
  payment_date: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  currency: string | null;
};

type PlanRow = {
  id: string;
  amount: number | string;
  due_date: string;
  description: string | null;
  installment_number: number;
};

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canFinance = hasAny(roles, ["admin", "accountant"]);
  const [payDialog, setPayDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  const canEdit = hasAny(roles, ["admin", "reception"]);
  const removeStudent = useServerFn(deleteStudent);

  const handleDelete = async () => {
    if (!confirm("حذف الطالب نهائيًا؟ سيتم حذف جميع سجلاته (حضور، علامات، دفعات، أقساط، وثائق).")) return;
    try {
      await removeStudent({ data: { id } });
      toast.success("تم حذف الطالب");
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate({ to: "/students", search: { q: "" } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  };



  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*, sections(section_number, gender)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", id],
    queryFn: async () => {
      const { data } = await supabase.from("student_payment_plans").select("*").eq("student_id", id).order("due_date");
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const { data } = await supabase.from("student_payments").select("*").eq("student_id", id).order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  // Payment plans have no currency column: they are always SYP. Only SYP payments
  // reduce the balance; USD payments are shown separately instead of being mixed in.
  const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments
    .filter((p) => asCurrency(p.currency) === "SYP")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalPaidUsd = payments
    .filter((p) => asCurrency(p.currency) === "USD")
    .reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalDue - totalPaid;

  if (!student) return <div>جارٍ التحميل…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/students" search={{ q: "" }}>
          <Button variant="outline" size="icon"><ArrowRight className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{student.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">رقم: {student.student_number}</Badge>
            <Badge variant="secondary">{gradeSectionLabel(student.grade_id, (student.sections as { section_number: number; gender: string | null } | null)?.section_number, (student.sections as { gender: string | null } | null)?.gender)}</Badge>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setEditDialog(true)}>
            <Pencil className="ml-2 h-4 w-4" /> تعديل البيانات
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => setTransferDialog(true)}>
            <ArrowLeftRight className="ml-2 h-4 w-4" /> نقل الصف/الشعبة
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="ml-2 h-4 w-4" /> حذف الطالب
          </Button>
        )}
        <Button variant="outline" onClick={() => setReportDialog(true)}>
          <FileText className="ml-2 h-4 w-4" /> تقرير الطالب
        </Button>
        <Button variant="outline" onClick={() => generateInvoicePDF(student, plans, payments)}>
          <Printer className="ml-2 h-4 w-4" /> طباعة الفاتورة
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">إجمالي المستحق</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalDue.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">إجمالي المدفوع</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">{totalPaid.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">الرصيد المتبقي</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${balance > 0 ? "text-destructive" : "text-success"}`}>{balance.toLocaleString("ar")}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">ولي الأمر</CardTitle></CardHeader><CardContent><div className="text-sm">{student.guardian_name || "—"}</div><div className="text-xs text-muted-foreground">{student.guardian_phone}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">خطة الدفع</TabsTrigger>
          <TabsTrigger value="payments">المدفوعات</TabsTrigger>
          <TabsTrigger value="info">المعلومات الشخصية</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="space-y-3">
          {canFinance && (
            <Button onClick={() => setPlanDialog(true)}><Plus className="ml-2 h-4 w-4" /> إضافة قسط</Button>
          )}
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              {canFinance && <TableHead className="text-right">إجراءات</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {plans.length === 0 && <TableRow><TableCell colSpan={canFinance ? 5 : 4} className="py-6 text-center text-muted-foreground">لا توجد أقساط</TableCell></TableRow>}
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.installment_number}</TableCell>
                  <TableCell>{p.description || "—"}</TableCell>
                  <TableCell>{p.due_date}</TableCell>
                  <TableCell className="font-mono">{Number(p.amount).toLocaleString("ar")}</TableCell>
                  {canFinance && (
                     <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" title="تعديل" onClick={() => setEditPlan(p as PlanRow)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="حذف" onClick={async () => {
                        if (!confirm("حذف هذا القسط؟")) return;
                        const { error } = await supabase.from("student_payment_plans").delete().eq("id", p.id);
                        if (error) return toast.error(error.message);
                        await logAudit(user, "delete", "student_payment_plans", p.id, p, null);
                        toast.success("تم الحذف");
                        qc.invalidateQueries({ queryKey: ["plans", id] });
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="payments" className="space-y-3">
          {canFinance && (
            <Button onClick={() => setPayDialog(true)}><Plus className="ml-2 h-4 w-4" /> تسجيل دفعة</Button>
          )}
          <Card><CardContent className="p-0"><Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">الطريقة</TableHead>
              <TableHead className="text-right">المرجع</TableHead>
              <TableHead className="text-right">ملاحظات</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">لا مدفوعات</TableCell></TableRow>}
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell className="font-mono">{formatMoney(Number(p.amount), asCurrency(p.currency))}</TableCell>
                  <TableCell>{p.method || "—"}</TableCell>
                  <TableCell>{p.reference || "—"}</TableCell>
                  <TableCell>{p.notes || "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" title="طباعة إيصال" onClick={() => generateReceiptPDF(student, p, { totalDue, totalPaid })}>
                      <Receipt className="h-4 w-4 text-primary" />
                    </Button>
                    {canFinance && (
                      <Button variant="ghost" size="icon" title="تعديل" onClick={() => setEditPayment(p as PaymentRow)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {canFinance && (
                      <Button variant="ghost" size="icon" title="حذف" onClick={async () => {
                        if (!confirm("حذف هذه الدفعة؟")) return;
                        const { error } = await supabase.from("student_payments").delete().eq("id", p.id);
                        if (error) return toast.error(error.message);
                        await logAudit(user, "delete", "student_payments", p.id, p, null);
                        toast.success("تم الحذف");
                        qc.invalidateQueries({ queryKey: ["payments", id] });
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="info">
          <Card><CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
            <Info label="رقم الطالب" value={student.student_number} />
            <Info label="العام الدراسي" value={student.academic_year} />
            <Info label="تاريخ التسجيل" value={student.enrollment_date} />
            <Info label="تاريخ الميلاد" value={student.birth_date} />
            <Info label="الجنس" value={student.gender === "male" ? "ذكر" : student.gender === "female" ? "أنثى" : student.gender} />
            <Info label="ولي الأمر" value={student.guardian_name} />
            <Info label="الهاتف" value={student.guardian_phone} />
            <Info label="صلة القرابة" value={student.guardian_relation} />
            <Info label="العنوان" value={student.address} />
            <Info label="ملاحظات" value={student.notes} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <PaymentDialog open={payDialog} onOpenChange={setPayDialog} studentId={id} onSaved={() => qc.invalidateQueries({ queryKey: ["payments", id] })} />
      <PaymentDialog
        key={editPayment?.id ?? "new-payment"}
        open={!!editPayment}
        onOpenChange={(v) => { if (!v) setEditPayment(null); }}
        studentId={id}
        payment={editPayment}
        onSaved={() => qc.invalidateQueries({ queryKey: ["payments", id] })}
      />
      <PlanDialog open={planDialog} onOpenChange={setPlanDialog} studentId={id} nextNumber={plans.length + 1} onSaved={() => qc.invalidateQueries({ queryKey: ["plans", id] })} />
      <PlanDialog
        key={editPlan?.id ?? "new-plan"}
        open={!!editPlan}
        onOpenChange={(v) => { if (!v) setEditPlan(null); }}
        studentId={id}
        nextNumber={editPlan?.installment_number ?? plans.length + 1}
        plan={editPlan}
        onSaved={() => qc.invalidateQueries({ queryKey: ["plans", id] })}
      />
      <ReportDialog open={reportDialog} onOpenChange={setReportDialog} student={student} />
      <StudentDialog open={editDialog} onOpenChange={setEditDialog} student={student} onSaved={() => { qc.invalidateQueries({ queryKey: ["student", id] }); qc.invalidateQueries({ queryKey: ["students"] }); }} />
      <TransferStudentDialog
        open={transferDialog}
        onOpenChange={setTransferDialog}
        student={student}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["student", id] }); qc.invalidateQueries({ queryKey: ["students"] }); }}
      />
    </div>
  );
}

function ReportDialog({ open, onOpenChange, student }: { open: boolean; onOpenChange: (v: boolean) => void; student: { id: string; full_name: string; student_number: number | string; grade_id?: number | null } }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const gen = async () => {
    if (!from || !to) return toast.error("حدد الفترة");
    setLoading(true);
    try {
      await generateStudentReport(student, from, to);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>تقرير الطالب — تحديد الفترة</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>من تاريخ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">يشمل التقرير جميع العلامات، الملاحظات السلوكية، وعدد أيام الحضور/التأخر/الغياب خلال الفترة المحددة.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <ExportMenu
            variant="default"
            label={loading ? "جارٍ الإنشاء…" : "إنشاء التقرير"}
            disabled={loading}
            onPdf={async () => { await gen(); }}
            doc={async () => {
              if (!from || !to) {
                toast.error("حدد الفترة");
                return null;
              }
              const d = await buildStudentReportDoc(student, from, to);
              onOpenChange(false);
              return d;
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-sm font-medium">{value || "—"}</div></div>
  );
}

function PaymentDialog({ open, onOpenChange, studentId, payment, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; studentId: string; payment?: PaymentRow | null; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [date, setDate] = useState(payment?.payment_date ?? new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(payment?.method ?? "نقدي");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [currency, setCurrency] = useState<Currency>(payment ? asCurrency(payment.currency) : "SYP");
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const values = { amount: Number(amount), payment_date: date, method, notes, currency };
    if (payment) {
      const { data, error } = await supabase.from("student_payments").update(values).eq("id", payment.id).select().single();
      if (error) return toast.error(error.message);
      await logAudit(user, "update", "student_payments", payment.id, payment, data);
      toast.success("تم تحديث الدفعة");
      onSaved(); onOpenChange(false);
      return;
    }
    const { data, error } = await supabase.from("student_payments").insert({
      student_id: studentId, ...values, recorded_by: user?.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "student_payments", data.id, null, data);
    toast.success("تم تسجيل الدفعة");
    onSaved(); onOpenChange(false); setAmount(""); setNotes("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{payment ? "تعديل الدفعة" : "تسجيل دفعة"}</DialogTitle></DialogHeader>
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
          <div><Label>الطريقة</Label><Input value={method} onChange={(e) => setMethod(e.target.value)} /></div>
          <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ open, onOpenChange, studentId, nextNumber, plan, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; studentId: string; nextNumber: number; plan?: PlanRow | null; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState(plan ? String(plan.amount) : "");
  const [dueDate, setDueDate] = useState(plan?.due_date ?? new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState(plan?.description ?? "");
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const values = { amount: Number(amount), due_date: dueDate, description: desc };
    if (plan) {
      const { data, error } = await supabase.from("student_payment_plans").update(values).eq("id", plan.id).select().single();
      if (error) return toast.error(error.message);
      await logAudit(user, "update", "student_payment_plans", plan.id, plan, data);
      toast.success("تم تحديث القسط");
      onSaved(); onOpenChange(false);
      return;
    }
    const { data, error } = await supabase.from("student_payment_plans").insert({
      student_id: studentId, ...values, installment_number: nextNumber,
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "student_payment_plans", data.id, null, data);
    toast.success("تم إضافة القسط");
    onSaved(); onOpenChange(false); setAmount(""); setDesc("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "تعديل القسط" : "إضافة قسط"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الوصف</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: قسط الفصل الأول" /></div>
          <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>تاريخ الاستحقاق</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
