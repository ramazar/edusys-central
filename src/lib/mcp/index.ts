import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSectionsTool from "./tools/list-sections";
import searchStudentsTool from "./tools/search-students";
import studentOverviewTool from "./tools/student-overview";
import attendanceSummaryTool from "./tools/attendance-summary";
import financeSummaryTool from "./tools/finance-summary";

// The OAuth issuer must be the direct Supabase host; the project ref is inlined
// at build time and survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "schooldesk-lohh-adar-almdrs",
  title: "SchoolDesk Hub",
  version: "0.1.0",
  instructions:
    "Read-only tools for the SchoolDesk school management app. Use list_sections to discover classes, search_students to find a student, student_overview for one student's attendance, marks and payments, attendance_summary for a single day, and finance_summary for income and expenses over a date range. All data is scoped to the signed-in user's school permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSectionsTool,
    searchStudentsTool,
    studentOverviewTool,
    attendanceSummaryTool,
    financeSummaryTool,
  ],
});
