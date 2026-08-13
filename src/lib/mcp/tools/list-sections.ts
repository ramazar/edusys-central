import { defineTool } from "@lovable.dev/mcp-js";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_sections",
  title: "List classes and sections",
  description:
    "List the grades and sections (classes) the signed-in user can access, with the number of active students in each section.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [sectionsRes, gradesRes, studentsRes] = await Promise.all([
      supabase.from("sections").select("id, grade_id, section_number, is_active"),
      supabase.from("grades").select("id, name_ar"),
      supabase.from("students").select("section_id").eq("is_active", true),
    ]);
    const error = sectionsRes.error ?? gradesRes.error ?? studentsRes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const gradeName = new Map((gradesRes.data ?? []).map((g) => [g.id, g.name_ar]));
    const counts = new Map<string, number>();
    for (const s of studentsRes.data ?? []) {
      counts.set(s.section_id, (counts.get(s.section_id) ?? 0) + 1);
    }

    const sections = (sectionsRes.data ?? []).map((s) => ({
      section_id: s.id,
      grade: gradeName.get(s.grade_id) ?? String(s.grade_id),
      section_number: s.section_number,
      is_active: s.is_active,
      active_students: counts.get(s.id) ?? 0,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(sections, null, 2) }],
      structuredContent: { sections },
    };
  },
});
