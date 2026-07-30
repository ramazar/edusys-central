// Unified export control: PDF / plain text / WhatsApp for any report.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileText, MessageCircle, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { printReport, type PrintColumn } from "@/lib/print-pdf";
import {
  downloadReportText,
  sendReportWhatsApp,
  sendToSectionGroup,
  type ExportTextDoc,
} from "@/lib/report-text";
import { useSectionGroups } from "@/hooks/useSectionGroups";

type DocGetter = () => ExportTextDoc | null | Promise<ExportTextDoc | null>;

export type SectionTarget = { id: string; label: string };

export function ExportMenu({
  doc,
  onPdf,
  pdfColumns,
  label = "تصدير",
  size,
  variant = "outline",
  className,
  disabled,
  sectionId,
  sectionTargets,
}: {
  /** Builds the report data (used for text/WhatsApp, and PDF when onPdf is absent). */
  doc: DocGetter;
  /** Custom PDF generator when the page has its own PDF layout. */
  onPdf?: () => void | Promise<void>;
  /** Column widths/alignment for the default PDF renderer. */
  pdfColumns?: PrintColumn[];
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
  /** Single section this report belongs to — enables "send to section group". */
  sectionId?: string | null;
  /** Several candidate sections (grade-wide reports) — user picks the group. */
  sectionTargets?: SectionTarget[];
}) {
  const [busy, setBusy] = useState(false);
  const { data: groups = [] } = useSectionGroups();

  const linkOf = (id: string) =>
    groups.find((g) => g.id === id)?.whatsapp_group_link || null;

  const resolve = async () => {
    const d = await doc();
    if (!d) return null;
    return d;
  };

  const guardRows = (d: ExportTextDoc) => {
    const hasRows = d.tables.some((t) => t.rows.length > 0);
    if (!hasRows) {
      toast.error("لا توجد بيانات للتصدير");
      return false;
    }
    return true;
  };

  const sendToGroup = async (id: string) => {
    const link = linkOf(id);
    if (!link) {
      toast.error("لم يتم ضبط رابط مجموعة لهذه الشعبة — أضفه من الإعدادات ← مجموعات واتساب");
      return;
    }
    setBusy(true);
    try {
      const d = await resolve();
      if (!d || !guardRows(d)) return;
      const { copied } = await sendToSectionGroup(d, link);
      toast.success(
        copied
          ? "تم نسخ التقرير — الصقه في المجموعة"
          : "تم فتح المجموعة — تعذّر النسخ التلقائي، استخدم تصدير نص",
      );
    } finally {
      setBusy(false);
    }
  };

  const run = async (kind: "pdf" | "text" | "whatsapp") => {
    setBusy(true);
    try {
      if (kind === "pdf" && onPdf) {
        await onPdf();
        return;
      }
      const d = await resolve();
      if (!d) return;
      if (!guardRows(d)) return;
      if (kind === "pdf") {
        const first = d.tables[0];
        printReport({
          title: d.title,
          subtitle: d.subtitle,
          meta: d.meta,
          columns:
            pdfColumns ??
            first.columns.map((h) => ({ header: h }) as PrintColumn),
          rows: first.rows,
        });
      } else if (kind === "text") {
        downloadReportText(d);
        toast.success("تم تنزيل الملف النصي");
      } else {
        const { trimmed } = await sendReportWhatsApp(d);
        toast.success(
          trimmed ? "تم فتح واتساب (تقرير مختصر — النص الكامل في الحافظة)" : "تم فتح واتساب",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const showSingle = !!sectionId;
  const showTargets = !sectionId && !!sectionTargets?.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled || busy}>
          <Share2 className="ms-1 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileDown className="ms-1 h-4 w-4" /> تصدير PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("text")}>
          <FileText className="ms-1 h-4 w-4" /> تصدير نص (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("whatsapp")}>
          <MessageCircle className="ms-1 h-4 w-4" /> إرسال في واتساب
        </DropdownMenuItem>

        {(showSingle || showTargets) && <DropdownMenuSeparator />}

        {showSingle && (
          <DropdownMenuItem onClick={() => sendToGroup(sectionId!)}>
            <Users className="ms-1 h-4 w-4" /> إرسال إلى مجموعة الشعبة
          </DropdownMenuItem>
        )}

        {showTargets && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Users className="ms-1 h-4 w-4" /> إرسال إلى مجموعة شعبة…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {sectionTargets!.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => sendToGroup(t.id)}>
                  {t.label}
                  {!linkOf(t.id) && (
                    <span className="ms-2 text-xs text-muted-foreground">(بلا رابط)</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
