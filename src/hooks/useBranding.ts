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
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["school_name", "logo_url"]);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((r) => {
        map[r.key] = r.value;
      });
      const b: Branding = {
        schoolName: map["school_name"]?.trim() || DEFAULT_BRANDING.schoolName,
        logoUrl: map["logo_url"] || null,
      };
      cacheBranding(b);
      return b;
    },
    staleTime: 5 * 60 * 1000,
    initialData: getBranding,
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
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
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
