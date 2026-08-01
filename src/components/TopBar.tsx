import { Bell, Search, LogOut, User } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { roleLabels, signOut, type AppRole } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SchoolSwitcher } from "@/components/SchoolSwitcher";

export function TopBar({
  fullName,
  email,
  roles,
  userId,
  activeSchoolId,
}: {
  fullName?: string | null;
  email?: string | null;
  roles: AppRole[];
  userId?: string;
  activeSchoolId: string | null;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/students", search: { q: q.trim() } as never });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
      <SidebarTrigger />
      <form onSubmit={onSearch} className="relative flex-1 max-w-lg">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن طالب، معلم، عامل…"
          className="pr-9 text-right"
        />
      </form>
      <SchoolSwitcher userId={userId} activeSchoolId={activeSchoolId} />
      <Button variant="ghost" size="icon" aria-label="الإشعارات">
        <Bell className="h-5 w-5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium leading-tight">{fullName || email}</div>
              <div className="flex gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant="secondary" className="h-4 text-[10px]">{roleLabels[r]}</Badge>
                ))}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            <div className="text-xs text-muted-foreground">{email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
            <LogOut className="ml-2 h-4 w-4" /> تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
