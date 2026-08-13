import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "student_overview",
  title: "Student overview",
  description:
    "Get one student's attendance counts, recent marks and notes, and payment totals over an optional date range.",
  inputSchema: {
    student_id: z.string().uuid().describe("The student id."),
    from: z.string().optional().describe("Start date, YYYY-MM-DD (inclusive)."),
    to: z.string().optional().describe("End date, YYYY-MM-DD (inclusive)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id, from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let attendanceQ = supabase.from("attendance").select("date, status").eq("student_id", student_id);
    let marksQ = supabase
      .from("daily_marks")
      .select("date, subject, score, max_score, notes")
      .eq("student_id", student_id)
      .order("date", { ascending: false })
      .limit(50);
    let paymentsQ = supabase
      .from("student_payments")
      .select("payment_date, amount, method, reference")
      .eq("student_id", student_id)
      .order("payment_date", { ascending: false });

    if (from) {
      attendanceQ = attendanceQ.gte("date", from);
      marksQ = marksQ.gte("date", from);
      paymentsQ = paymentsQ.gte("payment_date", from);
    }
    if (to) {
      attendanceQ = attendanceQ.lte("date", to);
      marksQ = marksQ.lte("date", to);
      paymentsQ = paymentsQ.lte("payment_date", to);
    }

    const [studentRes, attendanceRes, marksRes, paymentsRes, plansRes] = await Promise.all([
      supabase.from("students").select("id, full_name, student_number, academic_year").eq("id", student_id).maybeSingle(),
      attendanceQ,
      marksQ,
      paymentsQ,
      supabase.from("student_payment_plans").select("*").eq("student_id", student_id),
    ]);

    const error =
      studentRes.error ?? attendanceRes.error ?? marksRes.error ?? paymentsRes.error ?? plansRes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!studentRes.data) {
      return { content: [{ type: "text", text: "لم يتم العثور على الطالب أو لا تملك صلاحية الوصول إليه." }], isError: true };
    }

    const attendance = attendanceRes.data ?? [];
    const byStatus: Record<string, number> = {};
    for (const row of attendance) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

    const payments = paymentsRes.data ?? [];
    const paid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    const overview = {
      student: studentRes.data,
      attendance: { total_records: attendance.length, by_status: byStatus },
      marks: marksRes.data ?? [],
      payments: { total_paid: paid, count: payments.length, records: payments },
      payment_plans: plansRes.data ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview, null, 2) }],
      structuredContent: overview,
    };
  },
});
