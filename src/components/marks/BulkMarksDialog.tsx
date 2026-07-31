import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";

export type BulkStudent = { id: string; full_name: string; student_number: string };

export function BulkMarksDialog({
  students, onClose, onSaved,
}: { students: BulkStudent[]; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthSession();
  const [subject, setSubject] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [fillValue, setFillValue] = useState("");
  const [saving, setSaving] = useState(false);

  const filledCount = students.filter((s) => (scores[s.id] ?? "").trim() !== "").length;

  function fillAll() {
    if (fillValue.trim() === "") return;
    const next: Record<string, string> = {};
    students.forEach((s) => { next[s.id] = fillValue; });
    setScores(next);
  }

  async function save() {
    if (!subject.trim() || !maxScore) return toast.error("يرجى إدخال المادة والعلامة القصوى");
    const rows = students
      .filter((s) => (scores[s.id] ?? "").trim() !== "")
      .map((s) => ({
        student_id: s.id,
        subject: subject.trim(),
        score: Number(scores[s.id]),
        max_score: Number(maxScore),
        notes: (notes[s.id] ?? "").trim() || null,
        date,
        recorded_by: user?.id ?? null,
      }));
    if (rows.length === 0) return toast.error("لم تُدخل أي علامة");
    setSaving(true);
    const { error } = await supabase.from("daily_marks").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user, "bulk_create", "daily_marks", null, null, {
      count: rows.length, subject: subject.trim(), date,
    });
    toast.success(`تم حفظ علامات ${rows.length} طالب`);
    onSaved();
    onClose();
  }

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>إضافة علامات لشعبة كاملة</DialogTitle>
        <DialogDescription>أدخل المادة والعلامة القصوى ثم علامة كل طالب — الطلاب بدون علامة يتم تجاهلهم.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>المادة</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً: الرياضيات" className="text-right" />
        </div>
        <div>
          <Label>العلامة القصوى</Label>
          <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div>
          <Label>تعبئة الكل بعلامة</Label>
          <Input type="number" value={fillValue} onChange={(e) => setFillValue(e.target.value)} dir="ltr" className="w-32" />
        </div>
        <Button type="button" variant="outline" onClick={fillAll}>تعبئة الكل</Button>
        <Button type="button" variant="ghost" onClick={() => setScores({})}>تفريغ</Button>
      </div>

      <div className="max-h-[45vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>الطالب</TableHead>
              <TableHead className="w-28">العلامة</TableHead>
              <TableHead>ملاحظة (اختياري)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">لا يوجد طلاب</TableCell></TableRow>
            )}
            {students.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">
                  {s.full_name}
                  <div className="text-xs text-muted-foreground">{s.student_number}</div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    dir="ltr"
                    value={scores[s.id] ?? ""}
                    onChange={(e) => setScores((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="text-right"
                    value={notes[s.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} disabled={saving || filledCount === 0}>
          حفظ {filledCount > 0 ? `(${filledCount})` : ""}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
