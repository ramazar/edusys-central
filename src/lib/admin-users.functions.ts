import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "accountant" | "reception" | "teacher";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const createUserWithRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { email: string; password: string; fullName: string; roles: AppRole[] }) => {
      if (!data?.email || !data?.password || !data?.fullName) {
        throw new Error("Missing required fields");
      }
      if (data.password.length < 6) throw new Error("كلمة المرور قصيرة");
      if (!Array.isArray(data.roles) || data.roles.length === 0) {
        throw new Error("يجب اختيار دور واحد على الأقل");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (cErr) throw new Error(cErr.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Failed to create user");

    // Ensure profile exists (in case trigger didn't run)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newId, full_name: data.fullName, email: data.email }, { onConflict: "id" });

    const rows = data.roles.map((role) => ({ user_id: newId, role }));
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (rErr) throw new Error(rErr.message);

    return { id: newId };
  });

export const updateUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; roles: AppRole[] }) => {
    if (!data?.userId) throw new Error("Missing userId");
    if (!Array.isArray(data.roles)) throw new Error("Invalid roles");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent an admin from removing their own admin role (avoid lockout)
    if (data.userId === context.userId && !data.roles.includes("admin")) {
      throw new Error("لا يمكنك إزالة دور المدير عن نفسك");
    }

    const { error: dErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (dErr) throw new Error(dErr.message);

    if (data.roles.length > 0) {
      const rows = data.roles.map((role) => ({ user_id: data.userId, role }));
      const { error: iErr } = await supabaseAdmin.from("user_roles").insert(rows);
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId) throw new Error("Missing userId");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("لا يمكنك حذف حسابك الخاص");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
