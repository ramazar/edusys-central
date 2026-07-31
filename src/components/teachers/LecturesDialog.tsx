import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";

export type LectureType = { id: string; teacher_id: string; name: string; rate: number };
export type LectureLog = {
  id: string; teacher_id: string; lecture_type_id: string | null;
  type_name: string; rate: number; count: number; date: string; notes: string | null;
};

const db = supabase as never as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

export function useLectureTypes(teacherId?: string) {
  return useQuery({
    queryKey: ["teacher_lecture_types", teacherId ?? "all"],
    queryFn: async () => {
      let q = db.from("teacher_lecture_types").select("*").order("name");
      if (teacherId) q = (q as never as { eq: (a: string, b: string) => typeof q }).eq("teacher_id", teacherId);
      const { data } = await q;
      return (data ?? []) as unknown as LectureType[];
    },
  });
}

export function useLectureTotals() {
  return useQuery({
    queryKey: ["teacher_lectures_totals"],
    queryFn: async () => {
      const { data } = await db.from("teacher_lectures").select("teacher_id, count, rate");
      const totals: Record<string, { amount: number; lectures: number }> = {};
      ((data ?? []) as unknown as LectureLog[]).forEach((r) => {
        const cur = totals[r.teacher_id] ?? { amount: 0, lectures: 0 };
        cur.amount += Number(r.count) * Number(r.rate);
        cur.lectures += Number(r.count);
        totals[r.teacher_id] = cur;
      });
      return totals;
    },
  });
}

export function LecturesDialog({
  teacherId, teacherName, canManage, onClose,
}: { teacherId: string; teacherName: string; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: types = [] } = useLectureTypes(teacherId);

  const { data: logs = [] } = useQuery({
    queryKey: ["teacher_lectures", teacherId],
    queryFn: async () => {
      const { data } = await db
        .from("teacher_lectures")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("date", { ascending: false });
      return (data ?? []) as unknown as LectureLog[];
    },
  });

  // new lecture type
  const [typeName, setTypeName] = useState("");
  const [typeRate, setTypeRate] = useState("");

  // new lecture log
  const [typeId, setTypeId] = useState("");
  const [count, setCount] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["teacher_lectures", teacherId] });
    qc.invalidateQueries({ queryKey: ["teacher_lectures_totals"] });
    qc.invalidateQueries({ queryKey: ["teacher_lecture_types", teacherId] });
    qc.invalidateQueries({ queryKey: ["teacher_lecture_types", "all"] });
  };

  const total = logs.reduce((s, l) => s + Number(l.count) * Number(l.rate), 0);
  const totalLectures = logs.reduce((s, l) => s + Number(l.count), 0);

  const addType = async () => {
    if (!typeName.trim()) return toast.error("اسم نوع الحصة مطلوب");
    const payload = { teacher_id: teacherId, name: typeName.trim(), rate: Number(typeRate) || 0 };
    const { error } = await db.from("teacher_lecture_types").insert(payload as never);
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "teacher_lecture_types", teacherId, null, payload);
    setTypeName(""); setTypeRate("");
    toast.success("تم إضافة نوع الحصة");
    refresh();
  };

  const updateRate = async (t: LectureType, rate: string) => {
    const { error } = await db.from("teacher_lecture_types").update({ rate: Number(rate) || 0 } as never).eq("id", t.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const removeType = async (t: LectureType) => {
    if (!confirm(`حذف نوع الحصة "${t.name}"؟`)) return;
    const { error } = await db.from("teacher_lecture_types").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "teacher_lecture_types", t.id, t as never, null);
    refresh();
  };

  const addLog = async () => {
    const t = types.find((x) => x.id === typeId);
    if (!t) return toast.error("اختر نوع الحصة");
    const n = Number(count);
    if (!n || n <= 0) return toast.error("عدد الحصص غير صحيح");
    const payload = {
      teacher_id: teacherId,
      lecture_type_id: t.id,
      type_name: t.name,
      rate: Number(t.rate),
      count: n,
      date,
      notes: notes.trim() || null,
      recorded_by: user?.id ?? null,
    };
    const { error } = await db.from("teacher_lectures").insert(payload as never);
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "teacher_lectures", teacherId, null, payload);
    setCount("1"); setNotes("");
    toast.success("تم تسجيل الحصص");
    refresh();
  };

  const removeLog = async (l: LectureLog) => {
    if (!confirm("حذف هذا السجل؟")) return;
    const { error } = await db.from("teacher_lectures").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    await logAudit(user, "delete", "teacher_lectures", l.id, l as never, null);
    refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>الحصص والأجور — {teacherName}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">إجمالي الحصص</div>
            <div className="font-bold">{totalLectures.toLocaleString("ar")}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">إجمالي المستحق من الحصص</div>
            <div className="font-bold">{total.toLocaleString("ar")}</div>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-auto">
          <section className="space-y-2">
            <h3 className="font-semibold">أنواع الحصص وأجر الحصة</h3>
            {canManage && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <Label>اسم النوع</Label>
                  <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="مثال: حصة تقوية" />
                </div>
                <div className="w-36">
                  <Label>أجر الحصة</Label>
                  <Input type="number" dir="ltr" value={typeRate} onChange={(e) => setTypeRate(e.target.value)} />
                </div>
                <Button type="button" onClick={addType}><Plus className="ml-1 h-4 w-4" /> إضافة</Button>
              </div>
            )}
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">أجر الحصة</TableHead>
                {canManage && <TableHead className="text-right">حذف</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {types.length === 0 && (
                  <TableRow><TableCell colSpan={canManage ? 3 : 2} className="py-4 text-center text-muted-foreground">لا أنواع حصص بعد</TableCell></TableRow>
                )}
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono">
                      {canManage ? (
                        <Input
                          className="h-8 w-28"
                          dir="ltr"
                          type="number"
                          defaultValue={String(t.rate)}
                          onBlur={(e) => { if (Number(e.target.value) !== Number(t.rate)) updateRate(t, e.target.value); }}
                        />
                      ) : Number(t.rate).toLocaleString("ar")}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeType(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">تسجيل الحصص المُعطاة</h3>
            {canManage && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[160px]">
                  <Label>نوع الحصة</Label>
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} — {Number(t.rate).toLocaleString("ar")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>العدد</Label>
                  <Input type="number" dir="ltr" value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <div className="w-40">
                  <Label>التاريخ</Label>
                  <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="min-w-[140px] flex-1">
                  <Label>ملاحظة</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="button" onClick={addLog}><Plus className="ml-1 h-4 w-4" /> تسجيل</Button>
              </div>
            )}
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">العدد</TableHead>
                <TableHead className="text-right">أجر الحصة</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">ملاحظة</TableHead>
                {canManage && <TableHead className="text-right">حذف</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-4 text-center text-muted-foreground">لا حصص مسجلة</TableCell></TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.date}</TableCell>
                    <TableCell>{l.type_name}</TableCell>
                    <TableCell className="font-mono">{Number(l.count).toLocaleString("ar")}</TableCell>
                    <TableCell className="font-mono">{Number(l.rate).toLocaleString("ar")}</TableCell>
                    <TableCell className="font-mono font-semibold">{(Number(l.count) * Number(l.rate)).toLocaleString("ar")}</TableCell>
                    <TableCell>{l.notes || "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLog(l)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
