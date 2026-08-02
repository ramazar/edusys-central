// App-wide branding (school name + logo) stored in the app_settings table.
// A localStorage mirror lets non-React helpers (PDF/print templates) read it synchronously.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Branding = { schoolName: string; logoUrl: string | null };

export const DEFAULT_BRANDING: Branding = {
  schoolName: "SchoolDesk — إدارة المدرسة",
  logoUrl: null,
};

const CACHE_KEY = "schooldesk.branding";

export function getBranding(): Branding {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw) as Partial<Branding>;
    return {
      schoolName: parsed.schoolName?.trim() || DEFAULT_BRANDING.schoolName,
      logoUrl: parsed.logoUrl || null,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function cacheBranding(b: Branding) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    /* ignore quota errors */
  }
}

export function useBranding() {
  return useQuery({
    queryKey: ["app-branding"],
    queryFn: async (): Promise<Branding> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const { data: prof } = uid
        ? await supabase.from("profiles").select("active_school_id").eq("id", uid).maybeSingle()
        : { data: null };
      const schoolId = (prof?.active_school_id as string | null) ?? null;
      if (!schoolId) return DEFAULT_BRANDING;

      const [settingsRes, schoolRes] = await Promise.all([
        supabase
          .from("app_settings")
          .select("key, value")
          .eq("school_id", schoolId)
          .in("key", ["school_name", "logo_url"]),
        supabase.from("schools").select("name, logo_url").eq("id", schoolId).maybeSingle(),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      const map: Record<string, string | null> = {};
      (settingsRes.data ?? []).forEach((r) => {
        map[r.key] = r.value;
      });
      // Per-school overrides win; otherwise fall back to the school record itself.
      const b: Branding = {
        schoolName:
          map["school_name"]?.trim() || schoolRes.data?.name?.trim() || DEFAULT_BRANDING.schoolName,
        logoUrl: map["logo_url"] || (schoolRes.data?.logo_url as string | null) || null,
      };
      cacheBranding(b);
      return b;
    },
    staleTime: 5 * 60 * 1000,
  });
}


export function useSaveBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Branding) => {
      const rows = [
        { key: "school_name", value: b.schoolName.trim() || DEFAULT_BRANDING.schoolName },
        { key: "logo_url", value: b.logoUrl },
      ];
      const { data: profile } = await supabase.auth.getUser();
      const uid = profile.user?.id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_school_id")
        .eq("id", uid!)
        .maybeSingle();
      const schoolId = prof?.active_school_id as string | null;
      if (!schoolId) throw new Error("لا توجد مدرسة محددة لحسابك");
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          rows.map((r) => ({ ...r, school_id: schoolId })),
          { onConflict: "school_id,key" },
        );
      if (error) throw error;
      cacheBranding({ schoolName: rows[0].value as string, logoUrl: b.logoUrl });
      return b;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-branding"] }),
  });
}

/** Reads an image file as a data URL, downscaling it so it stays small enough to store. */
export function fileToLogoDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error("ملف الصورة غير صالح"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("تعذر معالجة الصورة"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
