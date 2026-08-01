// Opens a print window with Arabic-friendly HTML and triggers the browser's
// "Save as PDF" dialog. Using the browser's print pipeline avoids the Arabic
// glyph limitations of jsPDF's built-in fonts.

import { brandBlockHtml, brandName, brandStyles } from "@/lib/brand-header";

export type PrintColumn = { header: string; width?: string; align?: "right" | "left" | "center" };

export function printReport(opts: {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: (string | number)[][];
  meta?: { label: string; value: string }[];
  filename?: string;
}) {
  const { title, subtitle, columns, rows, meta = [] } = opts;

  const style = `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Cairo", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #1E293B; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1D4ED8; padding-bottom: 10px; margin-bottom: 14px; }
    header .brand { color: #1D4ED8; font-weight: 800; font-size: 20px; }
    header .date { color: #64748b; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { color: #64748b; font-size: 13px; margin-bottom: 10px; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #334155; margin-bottom: 12px; }
    .meta b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #1D4ED8; color: #fff; padding: 8px; text-align: right; font-weight: 700; }
    tbody td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .rank-1 td:first-child { background: #fde68a; font-weight: 800; }
    .rank-2 td:first-child { background: #e5e7eb; font-weight: 700; }
    .rank-3 td:first-child { background: #fed7aa; font-weight: 700; }
    footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { .noprint { display: none; } }
  `;

  const colgroup = `<colgroup>${columns.map((c) => `<col${c.width ? ` style="width:${c.width}"` : ""}/>`).join("")}</colgroup>`;
  const thead = `<thead><tr>${columns.map((c) => `<th style="text-align:${c.align ?? "right"}">${escape(c.header)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((r, i) => {
      const cls = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
      return `<tr class="${cls}">${r
        .map((cell, ci) => `<td style="text-align:${columns[ci]?.align ?? "right"}">${escape(String(cell ?? ""))}</td>`)
        .join("")}</tr>`;
    })
    .join("")}</tbody>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>${escape(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>${style}</style></head><body>
    <header>
      <div>
        ${brandBlockHtml()}
        <h1>${escape(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ""}
      </div>
      <div class="date">${new Date().toLocaleString("ar")}</div>
    </header>
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span><b>${escape(m.label)}:</b> ${escape(m.value)}</span>`).join("")}</div>` : ""}
    <table>${colgroup}${thead}${tbody}</table>
    <footer><span>${brandName()}</span><span>${new Date().toISOString().slice(0, 10)}</span></footer>
    <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},350));</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
