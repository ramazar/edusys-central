import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "finance_summary",
  title: "Finance summary",
  description:
    "Summarize school finances over a date range: student payments collected, other income, expenses, teacher salary payments, and the net total.",
  inputSchema: {
    from: z.string().describe("Start date, YYYY-MM-DD (inclusive)."),
    to: z.string().describe("End date, YYYY-MM-DD (inclusive)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [paymentsRes, incomeRes, expensesRes, salariesRes] = await Promise.all([
      supabase.from("student_payments").select("amount").gte("payment_date", from).lte("payment_date", to),
      supabase.from("income_entries").select("amount").gte("date", from).lte("date", to),
      supabase.from("expenses").select("amount, category").gte("date", from).lte("date", to),
      supabase.from("teacher_payments").select("amount").gte("payment_date", from).lte("payment_date", to),
    ]);
    const error = paymentsRes.error ?? incomeRes.error ?? expensesRes.error ?? salariesRes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const sum = (rows: { amount: number | null }[] | null) =>
      (rows ?? []).reduce((total, row) => total + Number(row.amount ?? 0), 0);

    const studentPayments = sum(paymentsRes.data);
    const otherIncome = sum(incomeRes.data);
    const expenses = sum(expensesRes.data);
    const salaries = sum(salariesRes.data);

    const summary = {
      range: { from, to },
      student_payments: studentPayments,
      other_income: otherIncome,
      expenses,
      teacher_salary_payments: salaries,
      net: studentPayments + otherIncome - expenses - salaries,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
