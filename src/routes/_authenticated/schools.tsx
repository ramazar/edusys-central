import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Building2, Plus, UserPlus, Pencil, Trash2 } from "lucide-react";
import { useAuthSession, useMyAccess, logAudit } from "@/hooks/useAuth";
import { createSchool, updateSchool, createSchoolAdmin, listAllSchools, deleteSchool } from "@/lib/schools.functions";


export const Route = createFileRoute("/_authenticated/schools")({
  component: SchoolsPage,
  head: () => ({
    meta: [
      { title: "المدارس — إدارة المدارس المشتركة" },
      { name: "description", content: "إنشاء المدارس وإدارة مدرائها داخل نظام SchoolDesk المشترك." },
      { property: "og:title", content: "المدارس — SchoolDesk" },
      { property: "og:description", content: "إنشاء المدارس وإدارة مدرائها داخل نظام SchoolDesk المشترك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SchoolRow = {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  members: number;
};

function SchoolsPage() {
  const { user } = useAuthSession();
  const { data: access, isLoading } = useMyAccess(user?.id);
  const qc = useQueryClient();
  const fetchSchools = useServerFn(listAllSchools);

  const { data: schools = [] } = useQuery({
    queryKey: ["all-schools"],
    enabled: !!access?.isSuperAdmin,
    queryFn: async () => (await fetchSchools()) as SchoolRow[],
  });

  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [adminFor, setAdminFor] = useState<SchoolRow | null>(null);
  const [deleting, setDeleting] = useState<SchoolRow | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["all-schools"] });


  if (isLoading) return <div className="text-muted-foreground">جارٍ التحميل…</div>;
  if (!access?.isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          هذه الصفحة متاحة لمدير النظام العام فقط.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المدارس</h1>
          <p className="text-sm text-muted-foreground">
            كل مدرسة لها بياناتها ومستخدموها بشكل منفصل تمامًا.
          </p>
        </div>
        <NewSchoolDialog onDone={refresh} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> قائمة المدارس ({schools.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المدرسة</TableHead>
                <TableHead className="text-right">المستخدمون</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    لا توجد مدارس بعد
                  </TableCell>
                </TableRow>
              )}
              {schools.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.members}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "secondary" : "outline"}>
                      {s.is_active ? "نشطة" : "موقوفة"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        <Pencil className="ml-1 h-3.5 w-3.5" /> تعديل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAdminFor(s)}>
                        <UserPlus className="ml-1 h-3.5 w-3.5" /> مدير للمدرسة
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(s)}>
                        <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف
                      </Button>

                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <EditSchoolDialog
          school={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {adminFor && (
        <AddSchoolAdminDialog
          school={adminFor}
          onClose={() => setAdminFor(null)}
          onDone={() => {
            setAdminFor(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <DeleteSchoolDialog
          school={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            refresh();
          }}
        />
      )}
    </div>

  );
}

function NewSchoolDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { user } = useAuthSession();
  const create = useServerFn(createSchool);
  const m = useMutation({
    mutationFn: async () => create({ data: { name } }),
    onSuccess: async (res) => {
      await logAudit(user, "create", "schools", (res as { id: string }).id, null, { name });
      toast.success("تم إنشاء المدرسة");
      setName("");
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الإنشاء"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ml-2 h-4 w-4" /> مدرسة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مدرسة</DialogTitle>
          <DialogDescription>تبدأ المدرسة فارغة، ثم تُنشئ لها حساب مدير.</DialogDescription>
        </DialogHeader>
        <div>
          <Label>اسم المدرسة</Label>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending ? "..." : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditSchoolDialog({
  school,
  onClose,
  onDone,
}: {
  school: SchoolRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(school.name);
  const [isActive, setIsActive] = useState(school.is_active);
  const update = useServerFn(updateSchool);
  const { user } = useAuthSession();
  const m = useMutation({
    mutationFn: async () => update({ data: { id: school.id, name, isActive } }),
    onSuccess: async () => {
      await logAudit(user, "update", "schools", school.id, school, { name, is_active: isActive });
      toast.success("تم الحفظ");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل {school.name}</DialogTitle>
          <DialogDescription>إيقاف المدرسة يمنع ظهورها في قائمة التبديل.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم المدرسة</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            مدرسة نشطة
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSchoolAdminDialog({
  school,
  onClose,
  onDone,
}: {
  school: SchoolRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const create = useServerFn(createSchoolAdmin);
  const { user } = useAuthSession();
  const m = useMutation({
    mutationFn: async () =>
      create({ data: { schoolId: school.id, email: email.trim().toLowerCase(), password, fullName } }),
    onSuccess: async (res) => {
      await logAudit(user, "create", "school_admin", (res as { id: string }).id, null, {
        school: school.name,
        email,
      });
      toast.success("تم إنشاء حساب المدير");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الإنشاء"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>مدير لمدرسة {school.name}</DialogTitle>
          <DialogDescription>يستطيع هذا الحساب إدارة مدرسته فقط.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم الكامل</Label>
            <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !email || !password || !fullName}>
            {m.isPending ? "..." : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
