import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useAuthSession, useMyRoles, hasAny } from "@/hooks/useAuth";
import { StudentDialog } from "@/components/students/StudentDialog";
import { gradeSectionLabel } from "@/lib/section-label";
import { deleteStudent } from "@/lib/students.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/")({
  validateSearch: (s: Record<string, unknown>) => ({ q: (s.q as string) ?? "" }),
  component: StudentsPage,
});

function StudentsPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState(q);
  const [gradeFilter, setGradeFilter] = useState<number | "">("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const canManage = hasAny(roles, ["admin", "reception"]);
  const removeStudent = useServerFn(deleteStudent);

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students", search, gradeFilter],
    queryFn: async () => {
      let query = supabase
        .from("students")
            .select("id, student_number, full_name, grade_id, section_id, guardian_name, guardian_phone, guardian_relation, address, enrollment_date, academic_year, gender, birth_date, notes, is_active, sections(section_number, gender)")
            .order("full_name")
            .limit(500);
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,student_number.ilike.%${search}%,guardian_name.ilike.%${search}%,guardian_phone.ilike.%${search}%`,
        );
      }
      if (gradeFilter !== "") query = query.eq("grade_id", gradeFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الطلاب</h1>
          <p className="text-sm text-muted-foreground">إدارة ملفات الطلاب وخطط الدفع</p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="ml-2 h-4 w-4" /> إضافة طالب
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                navigate({ to: "/students", search: { q: e.target.value } });
              }}
              placeholder="بحث بالاسم، الرقم، ولي الأمر، الهاتف…"
              className="pr-9"
            />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">كل الصفوف</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>{`الصف ${g}`}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الطالب</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الصف/الشعبة</TableHead>
                <TableHead className="text-right">ولي الأمر</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                {canManage && <TableHead className="text-right">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 && (
                <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-8 text-center text-muted-foreground">لا يوجد طلاب</TableCell></TableRow>
              )}
              {students.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell><Link to="/students/$id" params={{ id: s.id }} className="font-mono text-primary">{s.student_number}</Link></TableCell>
                  <TableCell><Link to="/students/$id" params={{ id: s.id }} className="font-medium">{s.full_name}</Link></TableCell>
                  <TableCell>
                    <Badge variant="secondary">{gradeSectionLabel(s.grade_id, (s.sections as { section_number: number; gender: string | null } | null)?.section_number, (s.sections as { gender: string | null } | null)?.gender)}</Badge>
                  </TableCell>
                  <TableCell>{s.guardian_name ?? "—"}</TableCell>
                  <TableCell>{s.guardian_phone ?? "—"}</TableCell>
                  <TableCell>
                    {s.is_active
                      ? <Badge className="bg-success text-success-foreground">نشط</Badge>
                      : <Badge variant="destructive">موقوف</Badge>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" title="تعديل" onClick={(e) => { e.stopPropagation(); setEditStudent(s); }}>
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" title="حذف" onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`حذف الطالب ${s.full_name} نهائيًا؟`)) return;
                        try {
                          await removeStudent({ data: { id: s.id } });
                          toast.success("تم حذف الطالب");
                          qc.invalidateQueries({ queryKey: ["students"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذّر الحذف");
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <StudentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => refetch()} />
      )}
      {canManage && (
        <StudentDialog
          open={!!editStudent}
          onOpenChange={(v) => { if (!v) setEditStudent(null); }}
          student={editStudent}
          onSaved={() => { setEditStudent(null); refetch(); }}
        />
      )}
    </div>
  );
}
