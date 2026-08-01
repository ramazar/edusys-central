import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { useBranding, useSaveBranding, fileToLogoDataUrl, DEFAULT_BRANDING } from "@/hooks/useBranding";

export function BrandingTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: branding } = useBranding();
  const save = useSaveBranding();
  const fileRef = useRef<HTMLInputElement>(null);
  const [schoolName, setSchoolName] = useState(branding?.schoolName ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(branding?.logoUrl ?? null);

  useEffect(() => {
    if (branding) {
      setSchoolName(branding.schoolName);
      setLogoUrl(branding.logoUrl);
    }
  }, [branding?.schoolName, branding?.logoUrl]);

  const pick = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر ملف صورة");
    if (file.size > 5 * 1024 * 1024) return toast.error("حجم الصورة كبير جدًا (الحد 5 ميغابايت)");
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setLogoUrl(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل الصورة");
    }
  };

  const submit = async () => {
    try {
      await save.mutateAsync({ schoolName: schoolName.trim() || DEFAULT_BRANDING.schoolName, logoUrl });
      toast.success("تم حفظ الهوية");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>الشعار وهوية المدرسة</CardTitle>
        <p className="text-xs text-muted-foreground">
          يظهر الشعار والاسم في الشريط الجانبي وفي جميع ملفات PDF (التقارير، الإيصالات، تقرير الطالب).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {logoUrl ? (
              <img src={logoUrl} alt="شعار المدرسة" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">لا شعار</span>
            )}
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="ml-2 h-4 w-4" /> اختيار صورة الشعار
              </Button>
              {logoUrl && (
                <Button variant="outline" className="text-destructive" onClick={() => setLogoUrl(null)}>
                  <Trash2 className="ml-2 h-4 w-4" /> إزالة الشعار
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG أو JPG — يتم تصغيرها تلقائيًا.</p>
            </div>
          )}
        </div>

        <div className="max-w-md">
          <Label>اسم المدرسة</Label>
          <Input
            className="mt-1"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            disabled={!isAdmin}
            placeholder={DEFAULT_BRANDING.schoolName}
          />
        </div>

        {isAdmin && (
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "..." : "حفظ"}
          </Button>
        )}
        {!isAdmin && <p className="text-xs text-muted-foreground">التعديل متاح للمدير فقط.</p>}
      </CardContent>
    </Card>
  );
}
