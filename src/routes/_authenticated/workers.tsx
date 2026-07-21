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
import { Plus, ScanLine, LogIn, LogOut, History, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, useMyRoles, hasAny, logAudit } from "@/hooks/useAuth";
import { printReport } from "@/lib/print-pdf";

export const Route = createFileRoute("/_authenticated/workers")({ component: WorkersPage });

type Worker = {
  id: string;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  attendance_code: string | null;
};

type AttendanceRow = {
  id: string;
  worker_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
};
const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

function WorkersPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "accountant"]);
  const canScan = hasAny(roles, ["admin", "accountant", "reception"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<Worker | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data } = await supabase.from("workers").select("*").order("full_name");
      return (data ?? []) as unknown as Worker[];
    },
  });

  const { data: todayAtt = [] } = useQuery({
    queryKey: ["worker_attendance_today"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("worker_attendance").select("*").eq("date", today());
      return (data ?? []) as AttendanceRow[];
    },
  });

  const attByWorker: Record<string, AttendanceRow> = {};
  todayAtt.forEach((r) => (attByWorker[r.worker_id] = r));

  const submitCode = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    const worker = workers.find((w) => (w.attendance_code || "").trim() === c);
    if (!worker) {
      toast.error("رمز غير معروف");
      setCode("");
      codeRef.current?.focus();
      return;
    }
    const existing = attByWorker[worker.id];
    const now = new Date().toISOString();
    if (!existing) {
      const { error } = await (supabase as any).from("worker_attendance").insert({
        worker_id: worker.id, date: today(), status: "present", check_in: now, recorded_by: user?.id,
      });
      if (error) { toast.error(error.message); return; }
      await logAudit(user, "check_in", "worker_attendance", worker.id, null, { check_in: now });
      toast.success(`تم تسجيل حضور ${worker.full_name} — ${fmtTime(now)}`);
    } else if (!existing.check_out) {
      const { error } = await (supabase as any).from("worker_attendance").update({ check_out: now }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit(user, "check_out", "worker_attendance", worker.id, null, { check_out: now });
      toast.success(`تم تسجيل انصراف ${worker.full_name} — ${fmtTime(now)}`);
    } else {
      toast.info(`${worker.full_name} سجّل حضوره وانصرافه اليوم`);
    }
    setCode("");
    codeRef.current?.focus();
    qc.invalidateQueries({ queryKey: ["worker_attendance_today"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العمال</h1>
          <p className="text-sm text-muted-foreground">حضور العمال بالرمز مع سجل شهري</p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="ml-2 h-4 w-4" /> إضافة عامل</Button>}
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
              <p className="text-xs text-muted-foreground">أول مسح = حضور، والمسح التالي في نفس اليوم = انصراف. يتم إعادة التصفير تلقائيًا كل يوم.</p>
            </form>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">الوظيفة</TableHead>
          <TableHead className="text-right">الرمز</TableHead>
          <TableHead className="text-right">حضور اليوم</TableHead>
          <TableHead className="text-right">انصراف اليوم</TableHead>
          <TableHead className="text-right">إجراءات</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {workers.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا يوجد عمال</TableCell></TableRow>}
          {workers.map((w) => {
            const att = attByWorker[w.id];
            return (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.full_name}</TableCell>
                <TableCell>{w.job_title || "—"}</TableCell>
                <TableCell className="font-mono" dir="ltr">{w.attendance_code || "—"}</TableCell>
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
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setHistoryOpen(w)}>
                    <History className="ml-1 h-4 w-4" /> السجل الشهري
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table></CardContent></Card>

      <WorkerDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["workers"] })} />
      {historyOpen && <MonthlyHistoryDialog worker={historyOpen} onClose={() => setHistoryOpen(null)} />}
    </div>
  );
}

function WorkerDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", attendance_code: randomCode() });
  const save = async () => {
    if (!form.full_name) return toast.error("الاسم مطلوب");
    const { data, error } = await supabase.from("workers").insert(form as never).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "workers", data.id, null, data);
    toast.success("تم إضافة العامل"); onSaved(); onOpenChange(false);
    setForm({ full_name: "", job_title: "", phone: "", attendance_code: randomCode() });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة عامل</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>الاسم</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>الوظيفة</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
          <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
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

function MonthlyHistoryDialog({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const start = `${month}-01`;
  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);

  const { data: rows = [] } = useQuery({
    queryKey: ["worker_attendance_month", worker.id, month],
    queryFn: async () => {
      const { data } = await (supabase as any).from("worker_attendance")
        .select("*").eq("worker_id", worker.id)
        .gte("date", start).lt("date", end)
        .order("date", { ascending: false });
      return (data ?? []) as AttendanceRow[];
    },
  });

  const presentDays = rows.filter((r) => r.status === "present").length;
  const absentDays = rows.filter((r) => r.status === "absent").length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>السجل الشهري — {worker.full_name}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>الشهر</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Badge className="bg-success text-success-foreground">حاضر: {presentDays}</Badge>
            <Badge variant="destructive">غائب: {absentDays}</Badge>
          </div>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الحضور</TableHead>
              <TableHead className="text-right">الانصراف</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد سجلات لهذا الشهر</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono" dir="ltr">{r.date}</TableCell>
                  <TableCell>{fmtTime(r.check_in)}</TableCell>
                  <TableCell>{fmtTime(r.check_out)}</TableCell>
                  <TableCell>
                    {r.status === "present" && <Badge className="bg-success text-success-foreground">حاضر</Badge>}
                    {r.status === "absent" && <Badge variant="destructive">غائب</Badge>}
                    {r.status === "late" && <Badge className="bg-warning text-warning-foreground">متأخر</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
