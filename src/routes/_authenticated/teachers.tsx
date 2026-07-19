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
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/teachers")({ component: TeachersPage });

function TeachersPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").order("full_name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المعلمون</h1>
          <p className="text-sm text-muted-foreground">قائمة المعلمين وسجل الرواتب</p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة معلم</Button>}
      </div>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">التخصص</TableHead>
          <TableHead className="text-right">الهاتف</TableHead>
          <TableHead className="text-right">الراتب الشهري</TableHead>
          <TableHead className="text-right">الحالة</TableHead>
          <TableHead className="text-right">إجراءات</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {teachers.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا يوجد معلمون</TableCell></TableRow>}
          {teachers.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.full_name}</TableCell>
              <TableCell>{(t.subjects || []).join("، ") || "—"}</TableCell>
              <TableCell>{t.phone || "—"}</TableCell>
              <TableCell className="font-mono">{Number(t.salary_amount || 0).toLocaleString("ar")}</TableCell>
              <TableCell>{t.is_active ? <Badge className="bg-success text-success-foreground">نشط</Badge> : <Badge variant="destructive">موقوف</Badge>}</TableCell>
              <TableCell>{canManage && <Button size="sm" variant="outline" onClick={() => setPayOpen(t.id)}><DollarSign className="ml-1 h-4 w-4" /> صرف راتب</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      <TeacherDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["teachers"] })} />
      {payOpen && <SalaryDialog teacherId={payOpen} onClose={() => setPayOpen(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["teachers"] })} />}
    </div>
  );
}

function TeacherDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "", salary_amount: 0 });
  const save = async () => {
    if (!form.full_name) return toast.error("الاسم مطلوب");
    const { data, error } = await supabase.from("teachers").insert(form).select().single();
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
