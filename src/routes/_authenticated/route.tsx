import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { useAuthSession, useMyProfile, useMyRoles } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, user, loading } = useAuthSession();
  const navigate = useNavigate();
  const { data: roles = [], isLoading: rolesLoading } = useMyRoles(user?.id);
  const { data: profile } = useMyProfile(user?.id);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جارٍ التحميل…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar roles={roles} />
        <SidebarInset className="flex-1">
          <TopBar fullName={profile?.full_name} email={user?.email} roles={roles} />
          <main className="p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
