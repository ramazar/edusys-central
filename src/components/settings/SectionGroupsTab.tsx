// Admin tab: store a WhatsApp group link per section.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, Save } from "lucide-react";
import { useSectionGroups } from "@/hooks/useSectionGroups";
import { normalizeGroupLink } from "@/lib/report-text";
import { useAuthSession, logAudit } from "@/hooks/useAuth";
import { sectionLabel } from "@/lib/section-label";

export function SectionGroupsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const { data: sections = [] } = useSectionGroups();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      sections.forEach((s) => {
        if (next[s.id] === undefined) next[s.id] = s.whatsapp_group_link ?? "";
      });
      return next;
    });
  }, [sections]);

  const save = async (id: string) => {
    const raw = (drafts[id] ?? "").trim();
    const link = raw ? normalizeGroupLink(raw) : null;
    setSaving(id);
    const { error } = await supabase
      .from("sections")
      .update({ whatsapp_group_link: link })
      .eq("id", id);
    setSaving(null);
    if (error) return toast.error(error.message);
    await logAudit(user, "update", "sections", id, null, { whatsapp_group_link: link });
    setDrafts((d) => ({ ...d, [id]: link ?? "" }));
    qc.invalidateQueries({ queryKey: ["section-whatsapp-groups"] });
    toast.success("تم حفظ رابط المجموعة");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>مجموعات واتساب للشُعب</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            الصق رابط دعوة مجموعة واتساب لكل شعبة (من واتساب: المجموعة ← رابط الدعوة ← نسخ).
          </p>
          <p>
            بعد الحفظ، أي تقرير (الحضور، الواجبات، الحصاد العلمي، العلامات، الترتيب) يمكن إرساله
            من قائمة «تصدير ← إرسال إلى مجموعة الشعبة»: يُنسخ نص التقرير تلقائيًا وتُفتح المجموعة
            لتلصقه بضغطة واحدة.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الصف</TableHead>
                <TableHead className="text-right">الشعبة</TableHead>
                <TableHead className="text-right">رابط مجموعة واتساب</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    لا توجد شُعب
                  </TableCell>
                </TableRow>
              )}
              {sections.map((s) => {
                const value = drafts[s.id] ?? "";
                const dirty = (s.whatsapp_group_link ?? "") !== value.trim();
                return (
                  <TableRow key={s.id}>
                    <TableCell>{`الصف ${s.grade_id}`}</TableCell>
                    <TableCell>{sectionLabel(s.section_number, s.gender)}</TableCell>
                    <TableCell>
                      <Input
                        dir="ltr"
                        placeholder="https://chat.whatsapp.com/..."
                        value={value}
                        disabled={!isAdmin}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => save(s.id)}
                          disabled={!isAdmin || !dirty || saving === s.id}
                        >
                          <Save className="ms-1 h-4 w-4" /> حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!s.whatsapp_group_link}
                          onClick={() =>
                            window.open(
                              normalizeGroupLink(s.whatsapp_group_link!),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <ExternalLink className="ms-1 h-4 w-4" /> اختبار
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">التعديل متاح للمدير فقط.</p>
      )}
    </div>
  );
}
