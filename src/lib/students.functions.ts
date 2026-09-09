import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanManageStudents(supabase: any, userId: string) {
  const { data: isAdmin, error: aErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (aErr) throw new Error(aErr.message);
  const { data: isReception, error: rErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "reception" });
  if (rErr) throw new Error(rErr.message);
  if (!isAdmin && !isReception) throw new Error("Forbidden: admin or reception only");
}

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Missing student id");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertCanManageStudents(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const studentId = data.id;
    // Delete child rows first; foreign keys are not cascading.
    const tables = [
      "attendance",
      "daily_marks",
      "homework_records",
      "student_documents",
      "student_payments",
      "student_payment_plans",
    ] as const;

    for (const t of tables) {
      const { error } = await supabaseAdmin.from(t).delete().eq("student_id", studentId);
      if (error) throw new Error(`${t}: ${error.message}`);
    }

    const { error } = await supabaseAdmin.from("students").delete().eq("id", studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
