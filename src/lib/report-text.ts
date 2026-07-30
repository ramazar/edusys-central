// Plain-text rendering of reports so any report that can be exported as PDF
// can also be downloaded as a .txt file or sent as a WhatsApp message.

export type TextTable = {
  heading?: string;
  columns: string[];
  rows: (string | number)[][];
};

export type ExportTextDoc = {
  title: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  tables: TextTable[];
  filename?: string;
};

export function buildReportText(doc: ExportTextDoc): string {
  const lines: string[] = [];
  lines.push(`*${doc.title}*`);
  if (doc.subtitle) lines.push(doc.subtitle);
  if (doc.meta?.length) {
    lines.push("");
    doc.meta.forEach((m) => lines.push(`• ${m.label}: ${m.value}`));
  }

  for (const t of doc.tables) {
    lines.push("");
    lines.push("──────────────");
    if (t.heading) lines.push(`*${t.heading}*`);
    if (t.rows.length === 0) {
      lines.push("لا توجد بيانات");
      continue;
    }
    t.rows.forEach((r, i) => {
      const cells = r
        .map((cell, ci) => {
          const value = String(cell ?? "").trim();
          if (!value) return "";
          const header = t.columns[ci];
          return header && header !== "#" ? `${header}: ${value}` : value;
        })
        .filter(Boolean);
      lines.push(`${i + 1}. ${cells.join(" — ")}`);
    });
  }

  lines.push("");
  lines.push(`SchoolDesk — ${new Date().toLocaleString("ar")}`);
  return lines.join("\n");
}

export function slugifyFilename(name: string) {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "report"
  );
}

export function downloadReportText(doc: ExportTextDoc) {
  const text = buildReportText(doc);
  const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(doc.filename ?? doc.title)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const WHATSAPP_TEXT_LIMIT = 1800;

/**
 * Opens WhatsApp with the report text prefilled so the user can pick the group
 * to send it to. Long reports are trimmed (the full text is copied to the
 * clipboard so nothing is lost).
 */
export async function sendReportWhatsApp(doc: ExportTextDoc): Promise<{ trimmed: boolean }> {
  const full = buildReportText(doc);
  let text = full;
  let trimmed = false;
  if (full.length > WHATSAPP_TEXT_LIMIT) {
    text = full.slice(0, WHATSAPP_TEXT_LIMIT) + "\n…\n(تم اختصار التقرير — النسخة الكاملة في الحافظة)";
    trimmed = true;
  }
  try {
    await navigator.clipboard?.writeText(full);
  } catch {
    // clipboard is optional
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  return { trimmed };
}
