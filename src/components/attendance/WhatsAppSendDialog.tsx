import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageCircle, ExternalLink } from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  student_number: string;
  guardian_phone?: string | null;
  guardian_name?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  students: Student[];
  absentIds?: string[];
  defaultCountryCode?: string;
  contextLabel?: string;
};

function normalizePhone(raw: string | null | undefined, countryCode: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p.slice(1);
  if (p.startsWith("00")) return p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  const cc = countryCode.replace(/[^\d]/g, "");
  if (p.startsWith(cc)) return p;
  return `${cc}${p}`;
}

export function WhatsAppSendDialog({
  open,
  onOpenChange,
  students,
  absentIds = [],
  defaultCountryCode = "963",
  contextLabel = "",
}: Props) {
  const [message, setMessage] = useState(
    "السلام عليكم، نعلمكم بأن الطالب/ة {student} تغيب عن المدرسة اليوم {date}. نرجو المتابعة. مع الشكر.",
  );
  const [cc, setCc] = useState(defaultCountryCode);
  const [onlyAbsent, setOnlyAbsent] = useState(absentIds.length > 0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const list = useMemo(() => {
    const base = onlyAbsent ? students.filter((s) => absentIds.includes(s.id)) : students;
    return base;
  }, [students, absentIds, onlyAbsent]);

  const buildUrl = (s: Student) => {
    const phone = normalizePhone(s.guardian_phone, cc);
    if (!phone) return null;
    const body = message
      .replaceAll("{student}", s.full_name)
      .replaceAll("{date}", new Date().toISOString().slice(0, 10))
      .replaceAll("{context}", contextLabel);
    return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
  };

  const toggleAll = (v: boolean) => {
    const m: Record<string, boolean> = {};
    list.forEach((s) => (m[s.id] = v && !!s.guardian_phone));
    setSelected(m);
  };

  const openOne = (s: Student) => {
    const url = buildUrl(s);
    if (!url) return toast.error(`لا يوجد رقم لولي أمر ${s.full_name}`);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sendSelected = async () => {
    const targets = list.filter((s) => selected[s.id] && s.guardian_phone);
    if (targets.length === 0) return toast.error("لم يتم تحديد أي طالب");
    toast.info(`سيتم فتح ${targets.length} نافذة واتساب بالتتابع`);
    for (let i = 0; i < targets.length; i++) {
      const url = buildUrl(targets[i]);
      if (url) {
        // stagger to avoid popup blocker collapsing
        setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), i * 400);
      }
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            إرسال رسائل واتساب لأولياء الأمور
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>نص الرسالة</Label>
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">
                المتغيّرات المتاحة: <code>{"{student}"}</code>، <code>{"{date}"}</code>
              </p>
            </div>
            <div>
              <Label>رمز الدولة الافتراضي</Label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-sm text-muted-foreground">+</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={cc}
                  onChange={(e) => setCc(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              {absentIds.length > 0 && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <Checkbox checked={onlyAbsent} onCheckedChange={(v) => setOnlyAbsent(!!v)} />
                  الغائبون فقط ({absentIds.length})
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-y py-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedCount > 0 && selectedCount === list.filter((s) => s.guardian_phone).length}
                onCheckedChange={(v) => toggleAll(!!v)}
              />
              تحديد الكل ({list.filter((s) => s.guardian_phone).length} برقم صالح)
            </label>
            <span className="text-xs text-muted-foreground">المحدَّد: {selectedCount}</span>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {list.map((s) => {
              const has = !!s.guardian_phone;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <label className="flex flex-1 items-center gap-2">
                    <Checkbox
                      disabled={!has}
                      checked={!!selected[s.id]}
                      onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [s.id]: !!v }))}
                    />
                    <div>
                      <div className="text-sm font-medium">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.student_number} · {has ? s.guardian_phone : "لا يوجد رقم"}
                      </div>
                    </div>
                  </label>
                  <Button size="sm" variant="outline" disabled={!has} onClick={() => openOne(s)}>
                    <ExternalLink className="ml-1 h-3 w-3" /> إرسال
                  </Button>
                </div>
              );
            })}
            {list.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">لا يوجد طلاب</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button onClick={sendSelected} disabled={selectedCount === 0}>
            <MessageCircle className="ml-2 h-4 w-4" /> فتح واتساب للمحدَّدين ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
