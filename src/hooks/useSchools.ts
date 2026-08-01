// Schools the signed-in user belongs to, plus switching the active school.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type School = {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
};

export function useMySchools(enabled = true) {
  return useQuery({
    queryKey: ["my-schools"],
    enabled,
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, logo_url, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as School[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetActiveSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, schoolId }: { userId: string; schoolId: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ active_school_id: schoolId })
        .eq("id", userId);
      if (error) throw error;
      return schoolId;
    },
    onSuccess: async () => {
      // Everything is scoped to the active school, so drop all cached data.
      await qc.invalidateQueries();
    },
  });
}
