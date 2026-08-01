import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMySchools, useSetActiveSchool } from "@/hooks/useSchools";

export function SchoolSwitcher({
  userId,
  activeSchoolId,
}: {
  userId?: string;
  activeSchoolId: string | null;
}) {
  const { data: schools = [] } = useMySchools(!!userId);
  const setActive = useSetActiveSchool();
  const active = schools.find((s) => s.id === activeSchoolId);
  const selectable = schools.filter((s) => s.is_active || s.id === activeSchoolId);

  if (selectable.length === 0) return null;

  const label = active?.name ?? "اختر مدرسة";

  if (selectable.length === 1) {
    return (
      <div className="hidden items-center gap-2 rounded-md border px-2 py-1.5 text-sm md:flex">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[14rem] truncate">{label}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={setActive.isPending}>
          <Building2 className="h-4 w-4" />
          <span className="max-w-[10rem] truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>المدرسة الحالية</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {selectable.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => {
              if (!userId || s.id === activeSchoolId) return;
              setActive.mutate(
                { userId, schoolId: s.id },
                {
                  onSuccess: () => toast.success(`تم التبديل إلى ${s.name}`),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التبديل"),
                },
              );
            }}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{s.name}</span>
            {s.id === activeSchoolId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
