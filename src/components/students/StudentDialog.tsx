import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";

export function StudentDialog({
  open, onOpenChange, onSaved, student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  student?: { id: string; full_name: string; student_number: string; grade_id: number; section_id: string; guardian_name?: string | null; guardian_phone?: string | null; guardian_relation?: string | null; address?: string | null; enrollment_date?: string | null; academic_year?: string | null; gender?: string | null; birth_date?: string | null; notes?: string | null; };
}) {
  const { user } = useAuthSession();
  const currentYear = new Date().getFullYear();
  const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;
  const [form, setForm] = useState({
    student_number: "",
    full_name: "",
    grade_id: 1,
    section_id: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_relation: "",
    address: "",
    enrollment_date: new Date().toISOString().slice(0, 10),
    academic_year: defaultAcademicYear,
    gender: "",
    birth_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<{ id: string; section_number: number; grade_id: number }[]>([]);

  useEffect(() => {
    supabase.from("sections").select("id, section_number, grade_id").eq("is_active", true)
      .then(({ data }) => setSections(data ?? []));
  }, [open]);

  useEffect(() => {
    if (student) {
      setForm({
        student_number: student.student_number,
        full_name: student.full_name,
        grade_id: student.grade_id,
        section_id: student.section_id,
        guardian_name: student.guardian_name ?? "",
        guardian_phone: student.guardian_phone ?? "",
        guardian_relation: student.guardian_relation ?? "",
        address: student.address ?? "",
        enrollment_date: student.enrollment_date ?? new Date().toISOString().slice(0, 10),
        academic_year: student.academic_year ?? defaultAcademicYear,
        gender: student.gender ?? "",
        birth_date: student.birth_date ?? "",
        notes: student.notes ?? "",
      });
    } else {
      setForm((f) => ({ ...f, student_number: `S${Date.now().toString().slice(-6)}` }));
    }
  }, [student, open]);

  const filteredSections = sections.filter((s) => s.grade_id === form.grade_id);

  const save = async () => {
    if (!form.full_name || !form.section_id) {
      toast.error("الاسم والشعبة مطلوبان");
      return;
    }
    setSaving(true);
    try {
      if (student) {
        const { error } = await supabase.from("students").update(form).eq("id", student.id);
        if (error) throw error;
        await logAudit(user, "update", "students", student.id, student, form);
        toast.success("تم تحديث الطالب");
      } else {
        const { data, error } = await supabase.from("students").insert(form).select().single();
        if (error) throw error;
        await logAudit(user, "create", "students", data.id, null, data);
        toast.success("تم إضافة الطالب");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{student ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>رقم الطالب</Label>
            <Input value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الصف</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={form.grade_id}
              onChange={(e) => setForm({ ...form, grade_id: Number(e.target.value), section_id: "" })}
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
              value={form.section_id}
              onChange={(e) => setForm({ ...form, section_id: e.target.value })}
            >
              <option value="">اختر الشعبة</option>
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>{`الشعبة ${s.section_number}`}</option>
              ))}
            </select>
            {filteredSections.length === 0 && (
              <p className="text-xs text-warning">لا توجد شُعب لهذا الصف. أضفها من الإعدادات.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>اسم ولي الأمر</Label>
            <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>هاتف ولي الأمر</Label>
            <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>صلة القرابة</Label>
            <Input value={form.guardian_relation} onChange={(e) => setForm({ ...form, guardian_relation: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ التسجيل</Label>
            <Input type="date" value={form.enrollment_date} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>العنوان</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
