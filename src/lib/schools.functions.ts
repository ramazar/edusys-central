import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export const createSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string }) => {
    if (!data?.name?.trim()) throw new Error("اسم المدرسة مطلوب");
    return { name: data.name.trim() };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: school, error } = await supabaseAdmin
      .from("schools")
      .insert({ name: data.name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    // Seed the school's own branding row so its name shows in the UI and PDFs.
    await supabaseAdmin
      .from("app_settings")
      .upsert(
        [{ school_id: school.id, key: "school_name", value: data.name }],
        { onConflict: "school_id,key" },
      );
    return school;
  });

export const updateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; name?: string; isActive?: boolean }) => {
    if (!data?.id) throw new Error("Missing school id");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { name?: string; is_active?: boolean } = {};
    if (typeof data.name === "string" && data.name.trim()) patch.name = data.name.trim();
    if (typeof data.isActive === "boolean") patch.is_active = data.isActive;
    const { error } = await supabaseAdmin.from("schools").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (patch.name) {
      await supabaseAdmin
        .from("app_settings")
        .upsert(
          [{ school_id: data.id, key: "school_name", value: patch.name }],
          { onConflict: "school_id,key" },
        );
    }
    return { ok: true };
  });

/** Creates (or re-uses) an account and makes it an admin of the given school. */
export const createSchoolAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { schoolId: string; email: string; password: string; fullName: string }) => {
    if (!data?.schoolId) throw new Error("Missing school id");
    if (!data.email || !data.fullName) throw new Error("البريد الإلكتروني والاسم مطلوبان");
    if (!data.password || data.password.length < 6) throw new Error("كلمة المرور قصيرة");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (cErr) throw new Error(cErr.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("فشل إنشاء المستخدم");

    // The role row must exist first: profiles.active_school_id is validated
    // against the user's memberships by a database trigger.
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert([{ user_id: newId, role: "admin", school_id: data.schoolId }]);
    if (rErr) throw new Error(rErr.message);

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newId, full_name: data.fullName, email: data.email, active_school_id: data.schoolId },
        { onConflict: "id" },
      );
    if (pErr) throw new Error(pErr.message);
    return { id: newId };
  });

/** Lets a super admin browse any school without being a member of it. */
export const listAllSchools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [schools, members] = await Promise.all([
      supabaseAdmin.from("schools").select("id, name, logo_url, is_active, created_at").order("name"),
      supabaseAdmin.from("user_roles").select("school_id, role"),
    ]);
    if (schools.error) throw new Error(schools.error.message);
    const counts: Record<string, number> = {};
    (members.data ?? []).forEach((m: { school_id: string | null }) => {
      if (m.school_id) counts[m.school_id] = (counts[m.school_id] ?? 0) + 1;
    });
    return (schools.data ?? []).map((s) => ({ ...s, members: counts[s.id] ?? 0 }));
  });
