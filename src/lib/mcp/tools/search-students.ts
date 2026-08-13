import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_students",
  title: "Search students",
  description:
    "Search students by name or student number, optionally limited to one section. Returns basic enrollment and guardian details.",
  inputSchema: {
    query: z.string().trim().optional().describe("Name or student number fragment to search for."),
    section_id: z.string().uuid().optional().describe("Limit results to this section id."),
    limit: z.number().int().optional().describe("Maximum number of students to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, section_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);

    let q = supabase
      .from("students")
      .select(
        "id, student_number, full_name, academic_year, section_id, grade_id, is_active, guardian_name, guardian_phone",
      )
      .order("full_name")
      .limit(take);
    if (section_id) q = q.eq("section_id", section_id);
    if (query) q = q.or(`full_name.ilike.%${query}%,student_number.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
