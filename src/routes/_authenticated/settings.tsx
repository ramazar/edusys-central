import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, UserPlus, Pencil } from "lucide-react";
import { useAuthSession, useMyRoles, logAudit, hasAny, roleLabels, type AppRole } from "@/hooks/useAuth";
import {
  createUserWithRoles,
  updateUserRoles,
  deleteUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

const ALL_ROLES: AppRole[] = ["admin", "accountant", "reception", "teacher"];

const roleTabs: Record<AppRole, string[]> = {
  admin: [
    "لوحة التحكم","الطلاب","الحضور","العلامات","الحصاد العلمي",
    "المعلمون","العمال","المالية","التقارير","سجل المراجعة","الإعدادات",
  ],
  accountant: ["لوحة التحكم","الطلاب","المعلمون","العمال","المالية","التقارير"],
  reception: ["لوحة التحكم","الطلاب","الحضور","العلامات","الحصاد العلمي","المعلمون","العمال","التقارير"],
  teacher: ["لوحة التحكم","الطلاب","الحضور","العلامات","الحصاد العلمي","المعلمون","التقارير"],
};

function SettingsPage() {
  const { user } = useAuthSession();
  const { data: roles = [] } = useMyRoles(user?.id);
  const isAdmin = hasAny(roles, ["admin"]);
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
        <TabsContent value="users"><UsersTab isAdmin={isAdmin} /></TabsContent>
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

type UserRow = { id: string; full_name: string | null; email: string | null; roles: AppRole[] };

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data: p } = await supabase.from("profiles").select("id, full_name, email");
      const { data: r } = await supabase.from("user_roles").select("user_id, role");
      const rolesMap: Record<string, AppRole[]> = {};
      (r ?? []).forEach((x) => {
        (rolesMap[x.user_id] = rolesMap[x.user_id] || []).push(x.role as AppRole);
      });
      return (p ?? []).map((u) => ({ ...u, roles: rolesMap[u.id] || [] }));
    },
  });

  const [editing, setEditing] = useState<UserRow | null>(null);

  const doDelete = useServerFn(deleteUser);
  const onDelete = async (u: UserRow) => {
    if (!confirm(`حذف المستخدم ${u.email}؟`)) return;
    try {
      await doDelete({ data: { userId: u.id } });
      await logAudit(user, "delete", "user", u.id, u, null);
      toast.success("تم حذف المستخدم");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>إدارة المستخدمين</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                لكل دور مجموعة تبويبات محددة يمكن الوصول إليها.
              </p>
            </div>
            <AddUserDialog onDone={() => qc.invalidateQueries({ queryKey: ["all-profiles"] })} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {ALL_ROLES.map((r) => (
                <div key={r} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">{roleLabels[r]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {roleTabs[r].join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">البريد الإلكتروني</TableHead>
          <TableHead className="text-right">الأدوار</TableHead>
          {isAdmin && <TableHead className="text-right">إجراءات</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {profiles.length === 0 && (
            <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-muted-foreground">لا يوجد مستخدمون</TableCell></TableRow>
          )}
          {profiles.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
              <TableCell>{u.email || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant="secondary">{roleLabels[r]}</Badge>
                  ))}
                </div>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      <Pencil className="ml-1 h-3.5 w-3.5" /> الأدوار
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={u.id === user?.id}
                      onClick={() => onDelete(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      {editing && (
        <EditRolesDialog
          userRow={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["all-profiles"] });
          }}
        />
      )}
    </div>
  );
}

function AddUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<AppRole[]>(["reception"]);
  const [loading, setLoading] = useState(false);
  const create = useServerFn(createUserWithRoles);
  const { user } = useAuthSession();

  const toggle = (r: AppRole) =>
    setSelected((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submit = async () => {
    if (selected.length === 0) return toast.error("اختر دوراً واحداً على الأقل");
    setLoading(true);
    try {
      const res = await create({ data: { email, password, fullName, roles: selected } });
      await logAudit(user, "create", "user", res.id, null, { email, fullName, roles: selected });
      toast.success("تم إنشاء المستخدم");
      setOpen(false);
      setFullName(""); setEmail(""); setPassword(""); setSelected(["reception"]);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="ml-2 h-4 w-4" /> إضافة مستخدم</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          <DialogDescription>حدد الأدوار لتتحكم بالتبويبات التي يمكنه الوصول إليها.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم الكامل</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>كلمة المرور</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} /></div>
          <div>
            <Label>الأدوار (التبويبات المسموحة)</Label>
            <div className="mt-2 grid gap-2">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-start gap-3 rounded-md border p-2">
                  <Checkbox checked={selected.includes(r)} onCheckedChange={() => toggle(r)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{roleLabels[r]}</div>
                    <div className="text-xs text-muted-foreground">{roleTabs[r].join(" · ")}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={loading || !email || !password || !fullName}>
            {loading ? "..." : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({
  userRow, onClose, onDone,
}: { userRow: UserRow; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<AppRole[]>(userRow.roles);
  const [loading, setLoading] = useState(false);
  const update = useServerFn(updateUserRoles);
  const { user } = useAuthSession();

  const toggle = (r: AppRole) =>
    setSelected((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async () => {
    setLoading(true);
    try {
      await update({ data: { userId: userRow.id, roles: selected } });
      await logAudit(user, "update", "user_roles", userRow.id, { roles: userRow.roles }, { roles: selected });
      toast.success("تم تحديث الأدوار");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل أدوار {userRow.full_name || userRow.email}</DialogTitle>
          <DialogDescription>حدد الأدوار لتتحكم بالتبويبات المسموحة.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-start gap-3 rounded-md border p-2">
              <Checkbox checked={selected.includes(r)} onCheckedChange={() => toggle(r)} />
              <div className="flex-1">
                <div className="text-sm font-medium">{roleLabels[r]}</div>
                <div className="text-xs text-muted-foreground">{roleTabs[r].join(" · ")}</div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={loading}>{loading ? "..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
