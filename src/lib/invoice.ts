// Arabic-friendly PDF generation via browser print window (Cairo font).
// Avoids jsPDF's built-in font glyph limitations.

type Student = {
  full_name: string;
  student_number: string;
  grade_id: number;
  sections?: { section_number: number } | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};
type Plan = { installment_number: number; description: string | null; due_date: string; amount: number | string };
type Payment = {
  id?: string;
  payment_date: string;
  amount: number | string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openPrint(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const baseStyles = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Cairo", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #1E293B; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1D4ED8; padding-bottom: 10px; margin-bottom: 14px; }
  header .brand { color: #1D4ED8; font-weight: 800; font-size: 20px; }
  header .date { color: #64748b; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 10px; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px 18px; font-size: 12px; color: #334155; margin-bottom: 14px; }
  .meta b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
  thead th { background: #1D4ED8; color: #fff; padding: 8px; text-align: right; font-weight: 700; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .section-title { font-weight: 700; margin: 14px 0 6px; color: #1D4ED8; font-size: 14px; }
  .totals { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .row.big { font-size: 16px; font-weight: 800; border-top: 2px solid #1D4ED8; margin-top: 6px; padding-top: 8px; }
  .totals .paid { color: #16a34a; }
  .totals .balance { color: #dc2626; }
  .receipt-box { border: 2px solid #1D4ED8; border-radius: 12px; padding: 18px; margin-top: 10px; }
  .receipt-amount { text-align: center; font-size: 34px; font-weight: 800; color: #1D4ED8; margin: 12px 0; }
  .receipt-amount small { display: block; font-size: 12px; color: #64748b; font-weight: 500; margin-top: 4px; }
  .stamp { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
  .stamp .box { border-top: 1px dashed #94a3b8; padding-top: 6px; min-width: 160px; text-align: center; }
  footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
`;

const fontLinks = `
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
`;

const autoPrint = `<script>window.addEventListener("load",()=>setTimeout(()=>{window.focus();window.print();},400));</script>`;

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateInvoicePDF(student: Student, plans: Plan[], payments: Payment[]) {
  const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalDue - totalPaid;

  const plansRows = plans.length
    ? plans
        .map(
          (p) => `<tr>
        <td>${p.installment_number}</td>
        <td>${escapeHtml(p.description ?? "—")}</td>
        <td>${escapeHtml(p.due_date)}</td>
        <td>${fmt(Number(p.amount))}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">لا توجد أقساط</td></tr>`;

  const payRows = payments.length
    ? payments
        .map(
          (p) => `<tr>
        <td>${escapeHtml(p.payment_date)}</td>
        <td>${fmt(Number(p.amount))}</td>
        <td>${escapeHtml(p.method ?? "—")}</td>
        <td>${escapeHtml(p.notes ?? "—")}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">لا توجد مدفوعات</td></tr>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>فاتورة ${escapeHtml(student.student_number)}</title>
    ${fontLinks}<style>${baseStyles}</style></head><body>
    <header>
      <div>
        <div class="brand">SchoolDesk — إدارة المدرسة</div>
        <h1>فاتورة الطالب</h1>
        <div class="subtitle">كشف الأقساط والمدفوعات</div>
      </div>
      <div class="date">${new Date().toLocaleString("ar-EG")}</div>
    </header>

    <div class="meta">
      <span><b>اسم الطالب:</b> ${escapeHtml(student.full_name)}</span>
      <span><b>رقم الطالب:</b> ${escapeHtml(student.student_number)}</span>
      <span><b>الصف:</b> ${student.grade_id} — الشعبة ${student.sections?.section_number ?? "—"}</span>
      <span><b>ولي الأمر:</b> ${escapeHtml(student.guardian_name ?? "—")}</span>
    </div>

    <div class="section-title">خطة الأقساط</div>
    <table>
      <thead><tr><th>#</th><th>الوصف</th><th>تاريخ الاستحقاق</th><th>المبلغ</th></tr></thead>
      <tbody>${plansRows}</tbody>
    </table>

    <div class="section-title">المدفوعات المستلمة</div>
    <table>
      <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>ملاحظات</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>إجمالي المستحق</span><span>${fmt(totalDue)}</span></div>
      <div class="row paid"><span>إجمالي المدفوع</span><span>${fmt(totalPaid)}</span></div>
      <div class="row big balance"><span>الرصيد المتبقي</span><span>${fmt(balance)}</span></div>
    </div>

    <footer><span>SchoolDesk</span><span>${new Date().toISOString().slice(0, 10)}</span></footer>
    ${autoPrint}
    </body></html>`;

  openPrint(html);
}

export function generateReceiptPDF(student: Student, payment: Payment, opts?: { totalDue?: number; totalPaid?: number }) {
  const balance =
    opts?.totalDue !== undefined && opts?.totalPaid !== undefined ? opts.totalDue - opts.totalPaid : undefined;

  const receiptNo = payment.id ? payment.id.slice(0, 8).toUpperCase() : String(Date.now()).slice(-8);

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>إيصال قبض ${receiptNo}</title>
    ${fontLinks}<style>${baseStyles}</style></head><body>
    <header>
      <div>
        <div class="brand">SchoolDesk — إدارة المدرسة</div>
        <h1>إيصال قبض</h1>
        <div class="subtitle">رقم الإيصال: ${receiptNo}</div>
      </div>
      <div class="date">${new Date().toLocaleString("ar-EG")}</div>
    </header>

    <div class="receipt-box">
      <div class="meta">
        <span><b>اسم الطالب:</b> ${escapeHtml(student.full_name)}</span>
        <span><b>رقم الطالب:</b> ${escapeHtml(student.student_number)}</span>
        <span><b>الصف:</b> ${student.grade_id} — الشعبة ${student.sections?.section_number ?? "—"}</span>
        <span><b>ولي الأمر:</b> ${escapeHtml(student.guardian_name ?? "—")}</span>
        <span><b>تاريخ الدفع:</b> ${escapeHtml(payment.payment_date)}</span>
        <span><b>طريقة الدفع:</b> ${escapeHtml(payment.method ?? "—")}</span>
        ${payment.reference ? `<span><b>المرجع:</b> ${escapeHtml(payment.reference)}</span>` : ""}
        ${payment.notes ? `<span><b>ملاحظات:</b> ${escapeHtml(payment.notes)}</span>` : ""}
      </div>

      <div class="receipt-amount">
        ${fmt(Number(payment.amount))}
        <small>المبلغ المستلم</small>
      </div>


      <div class="stamp">
        <div class="box">توقيع المستلم</div>
        <div class="box">ختم الإدارة</div>
      </div>
    </div>

    <footer><span>SchoolDesk — إيصال رسمي</span><span>${new Date().toISOString().slice(0, 10)}</span></footer>
    ${autoPrint}
    </body></html>`;

  openPrint(html);
}
