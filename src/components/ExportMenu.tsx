// Unified export control: PDF / plain text / WhatsApp for any report.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileText, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { printReport, type PrintColumn } from "@/lib/print-pdf";
import { downloadReportText, sendReportWhatsApp, type ExportTextDoc } from "@/lib/report-text";

type DocGetter = () => ExportTextDoc | null | Promise<ExportTextDoc | null>;

export function ExportMenu({
  doc,
  onPdf,
  pdfColumns,
  label = "تصدير",
  size,
  variant = "outline",
  className,
  disabled,
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
}) {
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    const d = await doc();
    if (!d) return null;
    return d;
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
      const hasRows = d.tables.some((t) => t.rows.length > 0);
      if (!hasRows) {
        toast.error("لا توجد بيانات للتصدير");
        return;
      }
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled || busy}>
          <Share2 className="ms-1 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileDown className="ms-1 h-4 w-4" /> تصدير PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("text")}>
          <FileText className="ms-1 h-4 w-4" /> تصدير نص (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("whatsapp")}>
          <MessageCircle className="ms-1 h-4 w-4" /> إرسال في واتساب
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
