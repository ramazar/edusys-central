import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";
import { sectionLabel } from "@/lib/section-label";

type SectionRow = { id: string; section_number: number; grade_id: number; gender: string | null };

export function TransferStudentDialog({
  open, onOpenChange, onSaved, student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  student: { id: string; full_name: string; grade_id: number; section_id: string };
}) {
  const { user } = useAuthSession();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [gradeId, setGradeId] = useState(student.grade_id);
  const [sectionId, setSectionId] = useState(student.section_id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGradeId(student.grade_id);
    setSectionId(student.section_id);
    supabase
      .from("sections")
      .select("id, section_number, grade_id, gender")
      .eq("is_active", true)
      .order("grade_id")
      .order("section_number")
      .then(({ data }) => setSections(data ?? []));
  }, [open, student.grade_id, student.section_id]);

  const filtered = sections.filter((s) => s.grade_id === gradeId);

  const save = async () => {
    if (!sectionId) return toast.error("اختر الشعبة");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ grade_id: gradeId, section_id: sectionId })
        .eq("id", student.id);
      if (error) throw error;
      await logAudit(
        user,
        "update",
        "students",
        student.id,
        { grade_id: student.grade_id, section_id: student.section_id },
        { grade_id: gradeId, section_id: sectionId },
      );
      toast.success("تم نقل الطالب");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النقل");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>نقل الطالب إلى صف/شعبة أخرى</DialogTitle>
          <DialogDescription>{student.full_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الصف</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={gradeId}
              onChange={(e) => { setGradeId(Number(e.target.value)); setSectionId(""); }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>{`الصف ${g}`}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>الشعبة</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">اختر الشعبة</option>
              {filtered.map((s) => (
                <option key={s.id} value={s.id}>{sectionLabel(s.section_number, s.gender)}</option>
              ))}
            </select>
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد شُعب لهذا الصف. أضفها من الإعدادات.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !sectionId}>{saving ? "..." : "نقل"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
