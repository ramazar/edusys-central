import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "attendance_summary",
  title: "Attendance summary",
  description:
    "Summarize student attendance for a single day, optionally for one section. Returns counts per status and the list of absent students.",
  inputSchema: {
    date: z.string().describe("The day to summarize, YYYY-MM-DD."),
    section_id: z.string().uuid().optional().describe("Limit to this section id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, section_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [attendanceRes, studentsRes] = await Promise.all([
      supabase.from("attendance").select("student_id, status, notes").eq("date", date),
      supabase.from("students").select("id, full_name, student_number, section_id").eq("is_active", true),
    ]);
    const error = attendanceRes.error ?? studentsRes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const students = (studentsRes.data ?? []).filter((s) => !section_id || s.section_id === section_id);
    const allowed = new Map(students.map((s) => [s.id, s]));
    const rows = (attendanceRes.data ?? []).filter((r) => allowed.has(r.student_id));

    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    const absent = rows
      .filter((r) => r.status !== "present")
      .map((r) => ({
        student: allowed.get(r.student_id)?.full_name,
        student_number: allowed.get(r.student_id)?.student_number,
        status: r.status,
        notes: r.notes,
      }));

    const summary = {
      date,
      section_id: section_id ?? null,
      students_in_scope: students.length,
      recorded: rows.length,
      not_recorded: Math.max(students.length - rows.length, 0),
      by_status: byStatus,
      absent_or_late: absent,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
