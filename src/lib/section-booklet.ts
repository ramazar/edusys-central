// Builds a printable booklet (استمارة) for a whole section:
// an index page (serial / name / page number) followed by one full page per
// student containing real system data: KPIs, level charts, marks, notes,
// lateness and absence days.

import { brandBlockHtml, brandName, brandStyles } from "@/lib/brand-header";
import { supabase } from "@/integrations/supabase/client";
import { chartsHtml } from "@/lib/student-report";
import { sectionLabel } from "@/lib/section-label";

type Student = { id: string; full_name: string; student_number: string | number };

type MarkRow = {
  student_id: string;
  date: string;
  subject: string | null;
  score: number | string;
  max_score: number | string;
  notes: string | null;
};

type AttendanceRow = {
  student_id: string;
  date: string;
  status: string;
  late_minutes: number | null;
};

export type SectionBookletArgs = {
  gradeId: number;
  sectionId: string;
  sectionNumber: number;
  gender: string | null;
  from: string;
  to: string;
};

export async function generateSectionBooklet(args: SectionBookletArgs) {
  const { gradeId, sectionId, sectionNumber, gender, from, to } = args;

  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, student_number")
    .eq("section_id", sectionId)
    .eq("is_active", true)
    .order("full_name");
  if (studentsError) throw new Error(studentsError.message);

  const students = (studentsData ?? []) as Student[];
  if (students.length === 0) throw new Error("لا يوجد طلاب في هذه الشعبة");

  const ids = students.map((s) => s.id);

  // Fetch in chunks so large sections stay within URL length limits.
  const marks: MarkRow[] = [];
  const attendance: AttendanceRow[] = [];
  const chunkSize = 40;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const [m, a] = await Promise.all([
      supabase
        .from("daily_marks")
        .select("student_id, date, subject, score, max_score, notes")
        .in("student_id", chunk)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      supabase
        .from("attendance")
        .select("student_id, date, status, late_minutes")
        .in("student_id", chunk)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
    ]);
    if (m.error) throw new Error(m.error.message);
    if (a.error) throw new Error(a.error.message);
    marks.push(...((m.data ?? []) as MarkRow[]));
    attendance.push(...((a.data ?? []) as AttendanceRow[]));
  }

  const marksBy = groupBy(marks, (r) => r.student_id);
  const attBy = groupBy(attendance, (r) => r.student_id);

  const secLabel = sectionLabel(sectionNumber, gender);
  const periodLine = `من ${from} إلى ${to}`;

  // ---- Build per-student pages (index page is page 1, students start at 2) ----
  const pages: string[] = [];
  const indexRows: string[] = [];

  // Rank within the section by overall percentage (students without marks rank last).
  const pctOf = (id: string) => {
    const scored = (marksBy.get(id) ?? []).filter((m) => Number(m.max_score ?? 0) > 0);
    const ts = scored.reduce((sum, m) => sum + Number(m.score ?? 0), 0);
    const tm = scored.reduce((sum, m) => sum + Number(m.max_score ?? 0), 0);
    return { pct: tm > 0 ? (ts / tm) * 100 : 0, hasMarks: tm > 0 };
  };
  const stats = students.map((s) => pctOf(s.id));
  const rankOf = (i: number) => {
    if (!stats[i].hasMarks) return null;
    return 1 + stats.filter((o) => o.hasMarks && o.pct > stats[i].pct).length;
  };

  students.forEach((s, i) => {
    const all = marksBy.get(s.id) ?? [];
    // Behavioural notes are stored with max_score = 0 and must never affect averages.
    const scored = all.filter((m) => Number(m.max_score ?? 0) > 0);
    const notes = all.filter((m) => !(Number(m.max_score ?? 0) > 0));

    const totalScore = scored.reduce((sum, m) => sum + Number(m.score ?? 0), 0);
    const totalMax = scored.reduce((sum, m) => sum + Number(m.max_score ?? 0), 0);
    const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

    const att = attBy.get(s.id) ?? [];
    const presentDays = att.filter((a) => a.status === "present");
    const lateDays = att.filter((a) => a.status === "late");
    const absentDays = att.filter((a) => a.status === "absent");

    const pageNumber = i + 2;
    indexRows.push(
      `<tr><td class="c">${pageNumber}</td><td>${esc(s.full_name)}</td><td class="c">${
        totalMax > 0 ? `${Math.round(pct)}%` : "—"
      }</td><td class="c">${i + 1}</td></tr>`,
    );

    pages.push(`<section class="page">
      <header>
        <div>
          ${brandBlockHtml()}
          <h1>${esc(s.full_name)}</h1>
          <div class="meta">
            <span><b>رقم الطالب:</b> ${esc(String(s.student_number))}</span>
            <span><b>الصف:</b> ${gradeId}</span>
            <span><b>الشعبة:</b> ${esc(secLabel)}</span>
            <span><b>الفترة:</b> ${esc(periodLine)}</span>
          </div>
        </div>
        <div class="serial">${i + 1}</div>
      </header>

      <div class="kpis">
        <div class="kpi"><div class="l">المعدل العام</div><div class="v ${pct >= 50 || totalMax === 0 ? "" : "bad"}">${
          totalMax > 0 ? `${Math.round(pct)}%` : "—"
        }</div></div>
        <div class="kpi"><div class="l">أيام الحضور</div><div class="v">${presentDays.length}</div></div>
        <div class="kpi"><div class="l">أيام التأخر</div><div class="v">${lateDays.length}</div></div>
        <div class="kpi"><div class="l">أيام الغياب</div><div class="v">${absentDays.length}</div></div>
      </div>

      <h2>مستوى الطالب</h2>
      ${chartsHtml(scored, pct)}

      <h2>العلامات</h2>
      ${
        scored.length
          ? `<table><thead><tr><th style="width:18%">التاريخ</th><th>المادة</th><th style="width:16%">الدرجة</th><th style="width:12%">النسبة</th><th style="width:26%">ملاحظة</th></tr></thead><tbody>${scored
              .map((m) => {
                const p = Math.round((Number(m.score) / Number(m.max_score)) * 100);
                return `<tr><td class="ltr">${esc(m.date)}</td><td>${esc(m.subject ?? "—")}</td><td class="ltr">${Number(
                  m.score,
                )} / ${Number(m.max_score)}</td><td class="c ${p >= 50 ? "" : "bad"}">${p}%</td><td>${esc(
                  m.notes ?? "",
                )}</td></tr>`;
              })
              .join("")}</tbody></table>`
          : `<div class="empty">لا توجد علامات في هذه الفترة</div>`
      }

      <h2>الملاحظات</h2>
      ${
        notes.length
          ? `<table><thead><tr><th style="width:18%">التاريخ</th><th style="width:20%">النوع</th><th>الملاحظة</th></tr></thead><tbody>${notes
              .map(
                (m) =>
                  `<tr><td class="ltr">${esc(m.date)}</td><td>${esc(m.subject ?? "ملاحظة")}</td><td>${esc(
                    m.notes ?? "",
                  )}</td></tr>`,
              )
              .join("")}</tbody></table>`
          : `<div class="empty">لا توجد ملاحظات في هذه الفترة</div>`
      }

      <div class="two">
        <div>
          <h2>التأخير</h2>
          ${
            lateDays.length
              ? `<ul class="list">${lateDays
                  .map(
                    (a) =>
                      `<li><span class="ltr">${esc(a.date)}</span>${
                        a.late_minutes ? ` — تأخر ${a.late_minutes} دقيقة` : ""
                      }</li>`,
                  )
                  .join("")}</ul>`
              : `<div class="empty">لا يوجد تأخير</div>`
          }
        </div>
        <div>
          <h2>الغياب</h2>
          ${
            absentDays.length
              ? `<ul class="list">${absentDays.map((a) => `<li><span class="ltr">${esc(a.date)}</span></li>`).join("")}</ul>`
              : `<div class="empty">لا يوجد غياب</div>`
          }
        </div>
      </div>

      <footer><span>${esc(brandName())}</span><span>${esc(s.full_name)} — صفحة ${pageNumber}</span></footer>
    </section>`);
  });

  const indexPage = `<section class="page">
    <header>
      <div>
        ${brandBlockHtml()}
        <h1>استمارة متابعة الطلاب — الصف ${gradeId} · ${esc(secLabel)}</h1>
        <div class="meta">
          <span><b>الفترة:</b> ${esc(periodLine)}</span>
          <span><b>عدد الطلاب:</b> ${students.length}</span>
        </div>
      </div>
      <div class="date ltr">${new Date().toISOString().slice(0, 10)}</div>
    </header>
    <h2>الفهرس</h2>
    <table><thead><tr>
      <th class="c" style="width:16%">رقم الصفحة</th>
      <th>الاسم</th>
      <th class="c" style="width:16%">المعدل</th>
      <th class="c" style="width:16%">الرقم التسلسلي</th>
    </tr></thead><tbody>${indexRows.join("")}</tbody></table>
    <footer><span>${esc(brandName())}</span><span>صفحة 1</span></footer>
  </section>`;

  const style = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Cairo","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif; direction: rtl; color: #1E293B; margin: 0; }
    .page { page-break-after: always; break-after: page; min-height: 0; }
    .page:last-of-type { page-break-after: auto; break-after: auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1D4ED8; padding-bottom: 8px; margin-bottom: 12px; }
    .brand { color: #1D4ED8; font-weight: 800; font-size: 16px; }
    h1 { font-size: 17px; margin: 6px 0 4px; }
    h2 { font-size: 14px; margin: 14px 0 6px; color: #1D4ED8; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 11px; color: #334155; }
    .meta b { color: #0f172a; }
    .serial { font-size: 26px; font-weight: 800; color: #1D4ED8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 2px 14px; }
    .date { color: #64748b; font-size: 11px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; background: #f8fafc; }
    .kpi .l { font-size: 10.5px; color: #64748b; }
    .kpi .v { font-size: 17px; font-weight: 800; color: #0f172a; }
    .kpi .v.bad, td.bad { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { background: #1D4ED8; color: #fff; padding: 6px; text-align: right; font-weight: 700; }
    thead th.c { text-align: center; }
    tbody td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; }
    tbody td.c { text-align: center; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .ltr { direction: ltr; unicode-bidi: embed; display: inline-block; }
    td.ltr { text-align: right; }
    .empty { color: #94a3b8; text-align: center; padding: 8px; font-size: 11px; border: 1px dashed #e2e8f0; border-radius: 8px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .list { margin: 0; padding-inline-start: 18px; font-size: 11px; }
    .list li { margin: 2px 0; }
    footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    .chart-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; background: #fff; page-break-inside: avoid; }
    .chart-title { font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 4px; }
    .bar-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 10.5px; }
    .bar-name { width: 32%; color: #0f172a; }
    .bar-track { flex: 1; height: 9px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 6px; }
    .bar-val { width: 38px; text-align: left; color: #334155; font-weight: 700; }
    ${brandStyles}
  `;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>استمارة الشعبة — الصف ${gradeId} ${esc(secLabel)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>${style}</style></head><body>
    ${indexPage}
    ${pages.join("")}
    <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},600));</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=1000,height=1100");
  if (!w) throw new Error("تم حجب النافذة المنبثقة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
  w.document.open();
  w.document.write(html);
  w.document.close();
  return students.length;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
