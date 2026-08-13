// WhatsApp group links stored per section.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SectionGroup = {
  id: string;
  grade_id: number;
  section_number: number;
  gender: string | null;
  whatsapp_group_link: string | null;
};

export function useSectionGroups() {
  return useQuery({
    queryKey: ["section-whatsapp-groups"],
    queryFn: async (): Promise<SectionGroup[]> => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, grade_id, section_number, gender, whatsapp_group_link")
        .order("grade_id")
        .order("section_number");
      if (error) throw error;
      return (data ?? []) as SectionGroup[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSectionGroupLink(sectionId?: string | null) {
  const { data = [] } = useSectionGroups();
  if (!sectionId) return null;
  return data.find((s) => s.id === sectionId)?.whatsapp_group_link || null;
}
