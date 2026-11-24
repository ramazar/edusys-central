import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { brandBlockHtml, brandName, brandStyles } from "@/lib/brand-header";

export type StudyPdfStudent = {
  id: string;
  full_name: string;
  student_number: string;
  section_label?: string;
};

export type StudyMarkRow = {
  id: string;
  student_id: string;
  date: string;
  subject: string;
  score: number;
  max_score: number;
  mark_type: string | null;
};

/** Keeps only real study marks inside the inclusive selected date range. */
export function filterStudyMarks<T extends Pick<StudyMarkRow, "date" | "max_score" | "mark_type">>(
  marks: T[],
  from: string,
  to: string,
): T[] {
  return marks.filter(
    (mark) =>
      mark.mark_type === "study" &&
      Number(mark.max_score) > 0 &&
      mark.date >= from &&
      mark.date <= to,
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberText(value: number): string {
  return String(Number(value));
}

async function fetchStudyMarks(studentIds: string[], from: string, to: string): Promise<StudyMarkRow[]> {
  const marks: StudyMarkRow[] = [];
  const chunkSize = 40;

  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const ids = studentIds.slice(i, i + chunkSize);
    const rows = await fetchAll<StudyMarkRow>((pageFrom, pageTo) =>
      supabase
        .from("daily_marks")
        .select("id, student_id, date, subject, score, max_score, mark_type")
        .in("student_id", ids)
        .eq("mark_type", "study")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .order("subject", { ascending: true })
        .order("id", { ascending: true })
        .range(pageFrom, pageTo),
    );
    marks.push(...rows);
  }

  return filterStudyMarks(marks, from, to);
}

/**
 * Opens the print window synchronously, then fills it with one section per
 * student. The browser's print dialog provides "Save as PDF" with Arabic text.
 */
export async function printStudyMarksPdf({
  students,
  from,
  to,
  scopeLabel,
}: {
  students: StudyPdfStudent[];
  from: string;
  to: string;
  scopeLabel: string;
}): Promise<{ students: number; marks: number }> {
  if (!from || !to) throw new Error("يرجى تحديد بداية الفترة ونهايتها");
  if (from > to) throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
  if (students.length === 0) throw new Error("لا يوجد طلاب ضمن الاختيار الحالي");

  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) throw new Error("يرجى السماح بالنوافذ المنبثقة لتجهيز ملف PDF");

  try {
    printWindow.document.write(
      '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جارٍ تجهيز علامات المذاكرة</title></head><body style="font-family:sans-serif;padding:40px">جارٍ تجهيز علامات المذاكرة…</body></html>',
    );

    const marks = await fetchStudyMarks(students.map((student) => student.id), from, to);
    const marksByStudent = new Map<string, StudyMarkRow[]>();
    for (const mark of marks) {
      const rows = marksByStudent.get(mark.student_id) ?? [];
      rows.push(mark);
      marksByStudent.set(mark.student_id, rows);
    }

    const studentSections = students
      .map((student, index) => {
        const rows = marksByStudent.get(student.id) ?? [];
        const body = rows.length
          ? rows
              .map(
                (mark) => `<tr>
                  <td>${escapeHtml(mark.date)}</td>
                  <td>${escapeHtml(mark.subject)}</td>
                  <td class="number">${numberText(mark.max_score)}</td>
                  <td class="number mark">${numberText(mark.score)}</td>
                </tr>`,
              )
              .join("")
          : '<tr><td colspan="4" class="empty">لا توجد علامات مذاكرة في هذه الفترة</td></tr>';

        return `<section class="student${index > 0 ? " new-page" : ""}">
          <div class="student-heading">
            <div>
              <h2>${escapeHtml(student.full_name)}</h2>
              <div class="student-meta">رقم الطالب: ${escapeHtml(student.student_number)}${student.section_label ? ` — الشعبة: ${escapeHtml(student.section_label)}` : ""}</div>
            </div>
            <div class="count">${rows.length} علامة</div>
          </div>
          <table>
            <thead><tr><th>التاريخ</th><th>المادة</th><th>العلامة القصوى</th><th>علامة الطالب</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </section>`;
      })
      .join("");

    const style = `
      @page { size: A4; margin: 13mm; }
      * { box-sizing: border-box; }
      body { font-family: "Cairo", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #1e293b; margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      header { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 16px; }
      .brand { color: #1d4ed8; font-weight: 800; font-size: 20px; }
      h1 { font-size: 20px; margin: 10px 0 4px; }
      h2 { font-size: 18px; margin: 0 0 3px; color: #1e3a8a; }
      .subtitle, .student-meta { color: #64748b; font-size: 12px; }
      .student { break-inside: avoid; margin-bottom: 22px; }
      .student.new-page { break-before: page; }
      .student-heading { display: flex; justify-content: space-between; align-items: center; border-right: 4px solid #1d4ed8; padding-right: 10px; margin-bottom: 9px; }
      .count { background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead { display: table-header-group; }
      thead th { background: #1d4ed8; color: #fff; padding: 8px; text-align: right; font-weight: 700; }
      tbody td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; }
      tbody tr { break-inside: avoid; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      td.number { text-align: center; width: 18%; direction: ltr; }
      td.mark { font-weight: 800; color: #1d4ed8; }
      .empty { text-align: center !important; color: #94a3b8; padding: 18px; }
      footer { margin-top: 16px; color: #94a3b8; font-size: 10px; text-align: center; }
      @media print { .student { break-inside: auto; } .student-heading { break-after: avoid; } }
      ${brandStyles}
    `;

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
      <title>علامات المذاكرة — ${escapeHtml(scopeLabel)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <style>${style}</style></head><body>
      <header>
        <div>
          ${brandBlockHtml()}
          <h1>علامات المذاكرة</h1>
          <div class="subtitle">${escapeHtml(scopeLabel)} — من ${escapeHtml(from)} إلى ${escapeHtml(to)}</div>
        </div>
        <div class="subtitle">${students.length} طالب — ${marks.length} علامة</div>
      </header>
      ${studentSections}
      <footer>${escapeHtml(brandName())}</footer>
      <script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},400));</script>
      </body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return { students: students.length, marks: marks.length };
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
