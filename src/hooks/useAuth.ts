import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type AppRole = "admin" | "accountant" | "reception" | "teacher" | "super_admin";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type Access = {
  activeSchoolId: string | null;
  /** Roles the user holds inside the currently active school. */
  roles: AppRole[];
  isSuperAdmin: boolean;
  schoolIds: string[];
};

/** Profile + per-school role rows in one query — the basis of all permission checks. */
export function useMyAccess(userId?: string) {
  return useQuery({
    queryKey: ["my-access", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Access> => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("active_school_id").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role, school_id").eq("user_id", userId!),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      const rows = rolesRes.data ?? [];
      const activeSchoolId = (profileRes.data?.active_school_id as string | null) ?? null;
      return {
        activeSchoolId,
        roles: rows.filter((r) => r.school_id && r.school_id === activeSchoolId).map((r) => r.role as AppRole),
        isSuperAdmin: rows.some((r) => (r.role as string) === "super_admin"),
        schoolIds: Array.from(new Set(rows.filter((r) => r.school_id).map((r) => r.school_id as string))),
      };
    },
  });
}

export function useMyRoles(userId?: string) {
  const q = useMyAccess(userId);
  return { ...q, data: q.data?.roles ?? [] };
}

export function useMyProfile(userId?: string) {
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}


export const roleLabels: Record<AppRole, string> = {
  admin: "مدير النظام",
  accountant: "المحاسب",
  reception: "موظف الاستقبال",
  teacher: "المعلم",
};

export function hasAny(roles: AppRole[] | undefined, allowed: AppRole[]): boolean {
  return !!roles?.some((r) => allowed.includes(r));
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export async function logAudit(
  user: User | null,
  action: string,
  module: string,
  entityId?: string,
  beforeData?: unknown,
  afterData?: unknown,
) {
  if (!user) return;
  try {
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      module,
      entity_id: entityId ?? null,
      before_data: (beforeData ?? null) as never,
      after_data: (afterData ?? null) as never,
    });
  } catch (e) {
    console.warn("audit failed", e);
  }
}
