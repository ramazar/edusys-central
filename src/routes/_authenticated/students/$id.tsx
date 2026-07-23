import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Printer, Plus, Trash2, Receipt, FileText } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { generateInvoicePDF, generateReceiptPDF } from "@/lib/invoice";
import { generateStudentReport } from "@/lib/student-report";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canFinance = hasAny(roles, ["admin", "accountant"]);
  const [payDialog, setPayDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*, sections(section_number)").eq("id", id).single();
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

  const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
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
            <Badge variant="secondary">الصف {student.grade_id} · الشعبة {(student.sections as { section_number: number } | null)?.section_number}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setReportDialog(true)}>
          <FileText className="ml-2 h-4 w-4" /> تقرير الطالب PDF
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={async () => {
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
                  <TableCell className="font-mono">{Number(p.amount).toLocaleString("ar")}</TableCell>
                  <TableCell>{p.method || "—"}</TableCell>
                  <TableCell>{p.reference || "—"}</TableCell>
                  <TableCell>{p.notes || "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" title="طباعة إيصال" onClick={() => generateReceiptPDF(student, p, { totalDue, totalPaid })}>
                      <Receipt className="h-4 w-4 text-primary" />
                    </Button>
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
            <Info label="تاريخ التسجيل" value={student.enrollment_date} />
            <Info label="ولي الأمر" value={student.guardian_name} />
            <Info label="الهاتف" value={student.guardian_phone} />
            <Info label="صلة القرابة" value={student.guardian_relation} />
            <Info label="العنوان" value={student.address} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <PaymentDialog open={payDialog} onOpenChange={setPayDialog} studentId={id} onSaved={() => qc.invalidateQueries({ queryKey: ["payments", id] })} />
      <PlanDialog open={planDialog} onOpenChange={setPlanDialog} studentId={id} nextNumber={plans.length + 1} onSaved={() => qc.invalidateQueries({ queryKey: ["plans", id] })} />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-sm font-medium">{value || "—"}</div></div>
  );
}

function PaymentDialog({ open, onOpenChange, studentId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; studentId: string; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const { data, error } = await supabase.from("student_payments").insert({
      student_id: studentId, amount: Number(amount), payment_date: date, method, notes, recorded_by: user?.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "student_payments", data.id, null, data);
    toast.success("تم تسجيل الدفعة");
    onSaved(); onOpenChange(false); setAmount(""); setNotes("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
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

function PlanDialog({ open, onOpenChange, studentId, nextNumber, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; studentId: string; nextNumber: number; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const { data, error } = await supabase.from("student_payment_plans").insert({
      student_id: studentId, amount: Number(amount), due_date: dueDate, description: desc, installment_number: nextNumber,
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "student_payment_plans", data.id, null, data);
    toast.success("تم إضافة القسط");
    onSaved(); onOpenChange(false); setAmount(""); setDesc("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة قسط</DialogTitle></DialogHeader>
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
