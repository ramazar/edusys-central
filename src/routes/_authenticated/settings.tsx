import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuthSession, logAudit } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إدارة الشُعب ومستخدمي النظام</p>
      </div>
      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">الشُعب</TabsTrigger>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
        </TabsList>
        <TabsContent value="sections"><SectionsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SectionsTab() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const [gradeId, setGradeId] = useState(1);
  const [sectionNumber, setSectionNumber] = useState(1);

  const { data: sections = [] } = useQuery({
    queryKey: ["all-sections"],
    queryFn: async () => (await supabase.from("sections").select("*").order("grade_id").order("section_number")).data ?? [],
  });

  const add = async () => {
    const { data, error } = await supabase.from("sections").insert({ grade_id: gradeId, section_number: sectionNumber, is_active: true }).select().single();
    if (error) return toast.error(error.message);
    await logAudit(user, "create", "sections", data.id, null, data);
    toast.success("تم الإضافة");
    qc.invalidateQueries({ queryKey: ["all-sections"] });
  };

  const toggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("sections").update({ is_active: !isActive }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit(user, "toggle_active", "sections", id, { is_active: isActive }, { is_active: !isActive });
    qc.invalidateQueries({ queryKey: ["all-sections"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>إضافة شعبة</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>الصف</Label>
            <select className="mt-1 h-9 rounded-md border bg-background px-3 text-sm" value={gradeId} onChange={(e) => setGradeId(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{`الصف ${g}`}</option>)}
            </select>
          </div>
          <div><Label>رقم الشعبة</Label><Input type="number" value={sectionNumber} onChange={(e) => setSectionNumber(Number(e.target.value))} className="mt-1 w-24" /></div>
          <Button onClick={add}>إضافة</Button>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الصف</TableHead>
          <TableHead className="text-right">الشعبة</TableHead>
          <TableHead className="text-right">الحالة</TableHead>
          <TableHead className="text-right">إجراءات</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {sections.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد شُعب</TableCell></TableRow>}
          {sections.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{`الصف ${s.grade_id}`}</TableCell>
              <TableCell>{`الشعبة ${s.section_number}`}</TableCell>
              <TableCell>{s.is_active ? "نشطة" : "موقوفة"}</TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => toggle(s.id, s.is_active)}>{s.is_active ? "إيقاف" : "تفعيل"}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  );
}

function UsersTab() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("id, full_name, email");
      const { data: r } = await supabase.from("user_roles").select("user_id, role");
      const rolesMap: Record<string, string[]> = {};
      (r ?? []).forEach((x) => { (rolesMap[x.user_id] = rolesMap[x.user_id] || []).push(x.role); });
      return (p ?? []).map((u) => ({ ...u, roles: rolesMap[u.id] || [] }));
    },
  });

  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead className="text-right">الاسم</TableHead>
        <TableHead className="text-right">البريد الإلكتروني</TableHead>
        <TableHead className="text-right">الأدوار</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {profiles.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">لا يوجد مستخدمون</TableCell></TableRow>}
        {profiles.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
            <TableCell>{u.email || "—"}</TableCell>
            <TableCell>{u.roles.join("، ") || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}
