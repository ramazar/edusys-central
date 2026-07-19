import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/workers")({ component: WorkersPage });

function WorkersPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => (await supabase.from("workers").select("*").order("full_name")).data ?? [],
  });

  const { data: todayAtt = [] } = useQuery({
    queryKey: ["worker-attendance", date],
    queryFn: async () => (await supabase.from("worker_attendance").select("worker_id, status").eq("date", date)).data ?? [],
  });

  const attMap: Record<string, string> = {};
  todayAtt.forEach((a) => (attMap[a.worker_id] = a.status));

  const markAttendance = async (workerId: string, status: "present" | "absent") => {
    const { error } = await supabase.from("worker_attendance").upsert({ worker_id: workerId, date, status, recorded_by: user?.id }, { onConflict: "worker_id,date" });
    if (error) return toast.error(error.message);
    await logAudit(user, "upsert", "worker_attendance", workerId, null, { date, status });
    qc.invalidateQueries({ queryKey: ["worker-attendance", date] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العمال</h1>
          <p className="text-sm text-muted-foreground">إدارة العمال والحضور والرواتب</p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة عامل</Button>}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Label>تاريخ الحضور:</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">الاسم</TableHead>
            <TableHead className="text-right">الوظيفة</TableHead>
            <TableHead className="text-right">الأجر اليومي</TableHead>
            <TableHead className="text-right">حضور اليوم</TableHead>
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {workers.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا يوجد عمال</TableCell></TableRow>}
            {workers.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.full_name}</TableCell>
                <TableCell>{w.job_title || "—"}</TableCell>
                <TableCell className="font-mono">{Number(w.salary_amount || 0).toLocaleString("ar")}</TableCell>
                <TableCell>
                  {attMap[w.id] === "present" && <Badge className="bg-success text-success-foreground">حاضر</Badge>}
                  {attMap[w.id] === "absent" && <Badge variant="destructive">غائب</Badge>}
                  {!attMap[w.id] && <Badge variant="secondary">لم يُسجّل</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => markAttendance(w.id, "present")}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => markAttendance(w.id, "absent")}>غائب</Button>
                    {canManage && <Button size="sm" variant="outline" onClick={() => setPayOpen(w.id)}><DollarSign className="ml-1 h-4 w-4" /> صرف</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>

      <WorkerDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["workers"] })} />
      {payOpen && <WorkerPayDialog workerId={payOpen} onClose={() => setPayOpen(null)} />}
    </div>
  );
}

function WorkerDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", salary_amount: 0 });
  const save = async () => {
    if (!form.full_name) return toast.error("الاسم مطلوب");
    const { data, error } = await supabase.from("workers").insert(form).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "workers", data.id, null, data);
    toast.success("تم إضافة العامل"); onSaved(); onOpenChange(false);
    setForm({ full_name: "", job_title: "", phone: "", salary_amount: 0 });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة عامل</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>الاسم</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>الوظيفة</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
          <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>الأجر اليومي</Label><Input type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkerPayDialog({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const save = async () => {
    if (!amount) return toast.error("المبلغ مطلوب");
    const { data, error } = await supabase.from("worker_payments").insert({ worker_id: workerId, amount: Number(amount), payment_date: date, recorded_by: user?.id }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "worker_payments", data.id, null, data);
    toast.success("تم الصرف"); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>صرف أجر عامل</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>التاريخ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
