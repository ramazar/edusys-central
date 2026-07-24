// Exports an attendance grid (students × dates) as a printable PDF matching
// the classic register look: ✓ (green) for present, ✗ (red) for absent.

export type GridCell = "present" | "absent" | "late" | null;

export function printAttendanceGrid(opts: {
  title: string;
  subtitle?: string;
  dates: string[]; // ISO YYYY-MM-DD, in display order (most recent first is fine)
  students: { id: string; full_name: string }[];
  cells: Record<string, Record<string, GridCell>>; // studentId -> date -> status
}) {
  const { title, subtitle, dates, students, cells } = opts;

  const fmtDay = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(d)}/${Number(m)}`;
  };

  const cellHtml = (v: GridCell) => {
    if (v === "present") return `<td class="c ok">✅</td>`;
    if (v === "absent") return `<td class="c no">❌</td>`;
    if (v === "late") return `<td class="c late">⏰</td>`;
    return `<td class="c"></td>`;
  };

  const style = `
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: "Cairo","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif; direction: rtl; color: #1E293B; margin: 0; }
    header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1D4ED8; padding-bottom:8px; margin-bottom:10px; }
    .brand { color:#1D4ED8; font-weight:800; font-size:18px; }
    h1 { font-size:16px; margin:0; }
    .subtitle { color:#64748b; font-size:12px; }
    table { width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed; }
    th, td { border:1px solid #cbd5e1; padding:4px; text-align:center; }
    thead th { background:#f1f5f9; font-weight:700; }
    th.name, td.name { text-align:right; width:180px; }
    th.idx, td.idx { width:36px; }
    td.c { font-size:14px; }
    td.ok { background:#dcfce7; color:#16a34a; }
    td.no { background:#fee2e2; color:#dc2626; }
    td.late { background:#fef3c7; color:#b45309; }
    tbody tr:nth-child(even) td.name { background:#f8fafc; }
  `;

  const thead = `<thead><tr>
    <th class="idx">#</th>
    <th class="name">الاسم</th>
    ${dates.map((d) => `<th>${fmtDay(d)}</th>`).join("")}
  </tr></thead>`;

  const tbody = `<tbody>${students
    .map((s, i) => {
      const row = dates.map((d) => cellHtml(cells[s.id]?.[d] ?? null)).join("");
      return `<tr><td class="idx">${i + 1}</td><td class="name">${escape(s.full_name)}</td>${row}</tr>`;
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
        <div class="brand">SchoolDesk — إدارة المدرسة</div>
        <h1>${escape(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ""}
      </div>
      <div class="subtitle">${new Date().toLocaleString("ar")}</div>
    </header>
    <table>${thead}${tbody}</table>
    <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},400));</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
