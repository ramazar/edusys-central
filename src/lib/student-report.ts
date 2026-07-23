// Generates a comprehensive per-student PDF report over a date range:
// marks, behavioral comments, and attendance day counts.

import { supabase } from "@/integrations/supabase/client";

type Student = { id: string; full_name: string; student_number: number | string; grade_id?: number | null };

export async function generateStudentReport(student: Student, from: string, to: string) {
  const [{ data: marks = [] }, { data: attendance = [] }] = await Promise.all([
    supabase
      .from("daily_marks")
      .select("*")
      .eq("student_id", student.id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("attendance")
      .select("date,status")
      .eq("student_id", student.id)
      .gte("date", from)
      .lte("date", to),
  ]);

  const marksRows = (marks ?? []).filter((m: any) => Number(m.max_score ?? 0) > 0);
  const noteRows = (marks ?? []).filter((m: any) => !(Number(m.max_score ?? 0) > 0));

  const totalScore = marksRows.reduce((s: number, m: any) => s + Number(m.score ?? 0), 0);
  const totalMax = marksRows.reduce((s: number, m: any) => s + Number(m.max_score ?? 0), 0);
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : 0;

  const present = (attendance ?? []).filter((a: any) => a.status === "present").length;
  const late = (attendance ?? []).filter((a: any) => a.status === "late").length;
  const absent = (attendance ?? []).filter((a: any) => a.status === "absent").length;
  const totalDays = present + late + absent;

  const style = `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Cairo","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif; direction: rtl; color: #1E293B; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1D4ED8; padding-bottom: 10px; margin-bottom: 14px; }
    .brand { color: #1D4ED8; font-weight: 800; font-size: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 18px 0 8px; color: #1D4ED8; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: #334155; margin-bottom: 8px; }
    .meta b { color: #0f172a; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 4px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
    .kpi .l { font-size: 11px; color: #64748b; }
    .kpi .v { font-size: 18px; font-weight: 800; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #1D4ED8; color: #fff; padding: 7px; text-align: right; font-weight: 700; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .empty { color: #94a3b8; text-align: center; padding: 10px; font-size: 12px; }
    .date { color: #64748b; font-size: 12px; }
    footer { margin-top: 14px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  `;

  const marksTable = marksRows.length
    ? `<table><thead><tr><th>التاريخ</th><th>المادة</th><th>الدرجة</th><th>من</th><th>النسبة</th><th>ملاحظات</th></tr></thead>
       <tbody>${marksRows
         .map(
           (m: any) => `<tr>
             <td>${esc(m.date)}</td>
             <td>${esc(m.subject ?? "—")}</td>
             <td>${Number(m.score).toLocaleString("ar")}</td>
             <td>${Number(m.max_score).toLocaleString("ar")}</td>
             <td>${Math.round((Number(m.score) / Number(m.max_score)) * 100)}%</td>
             <td>${esc(m.notes ?? "")}</td>
           </tr>`,
         )
         .join("")}</tbody></table>`
    : `<div class="empty">لا توجد علامات في هذه الفترة</div>`;

  const notesTable = noteRows.length
    ? `<table><thead><tr><th>التاريخ</th><th>النوع</th><th>الملاحظة</th></tr></thead>
       <tbody>${noteRows
         .map(
           (m: any) => `<tr>
             <td>${esc(m.date)}</td>
             <td>${esc(m.subject ?? "ملاحظة")}</td>
             <td>${esc(m.notes ?? "")}</td>
           </tr>`,
         )
         .join("")}</tbody></table>`
    : `<div class="empty">لا توجد ملاحظات في هذه الفترة</div>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>تقرير الطالب — ${esc(student.full_name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>${style}</style></head><body>
    <header>
      <div>
        <div class="brand">SchoolDesk — إدارة المدرسة</div>
        <h1>تقرير الطالب: ${esc(student.full_name)}</h1>
        <div class="meta">
          <span><b>رقم الطالب:</b> ${esc(String(student.student_number))}</span>
          ${student.grade_id ? `<span><b>الصف:</b> ${esc(String(student.grade_id))}</span>` : ""}
          <span><b>من:</b> ${esc(from)}</span>
          <span><b>إلى:</b> ${esc(to)}</span>
        </div>
      </div>
      <div class="date">${new Date().toLocaleString("ar")}</div>
    </header>

    <div class="kpis">
      <div class="kpi"><div class="l">أيام الحضور</div><div class="v">${present.toLocaleString("ar")}</div></div>
      <div class="kpi"><div class="l">أيام التأخر</div><div class="v">${late.toLocaleString("ar")}</div></div>
      <div class="kpi"><div class="l">أيام الغياب</div><div class="v">${absent.toLocaleString("ar")}</div></div>
      <div class="kpi"><div class="l">إجمالي الأيام المسجّلة</div><div class="v">${totalDays.toLocaleString("ar")}</div></div>
    </div>

    <h2>العلامات</h2>
    ${marksTable}

    <h2>الملاحظات والتعليقات</h2>
    ${notesTable}

    <footer><span>SchoolDesk</span><span>${new Date().toISOString().slice(0, 10)}</span></footer>
    <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},400));</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
