import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Student = { full_name: string; student_number: string; grade_id: number; sections?: { section_number: number } | null };
type Plan = { installment_number: number; description: string | null; due_date: string; amount: number | string };
type Payment = { payment_date: string; amount: number | string; method: string | null };

export function generateInvoicePDF(student: Student, plans: Plan[], payments: Payment[]) {
  const doc = new jsPDF();
  // Use built-in font; Arabic will be limited but readable numerically
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SchoolDesk - Invoice", 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Student: ${student.full_name}`, 15, 30);
  doc.text(`No: ${student.student_number}`, 15, 37);
  doc.text(`Grade ${student.grade_id} - Section ${student.sections?.section_number ?? "-"}`, 15, 44);
  doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`, 150, 30);

  autoTable(doc, {
    startY: 55,
    head: [["#", "Description", "Due Date", "Amount"]],
    body: plans.map((p) => [p.installment_number, p.description ?? "-", p.due_date, Number(p.amount).toFixed(2)]),
    theme: "grid",
    headStyles: { fillColor: [29, 78, 216] },
  });

  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text("Payments", 15, y1);
  autoTable(doc, {
    startY: y1 + 3,
    head: [["Date", "Amount", "Method"]],
    body: payments.map((p) => [p.payment_date, Number(p.amount).toFixed(2), p.method ?? "-"]),
    theme: "grid",
    headStyles: { fillColor: [29, 78, 216] },
  });

  const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Due: ${totalDue.toFixed(2)}`, 15, y2);
  doc.text(`Total Paid: ${totalPaid.toFixed(2)}`, 15, y2 + 7);
  doc.text(`Balance: ${(totalDue - totalPaid).toFixed(2)}`, 15, y2 + 14);

  doc.save(`invoice-${student.student_number}.pdf`);
}
