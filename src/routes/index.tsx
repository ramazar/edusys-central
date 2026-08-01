import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoaderCircle className="h-8 w-8 animate-spin text-primary" aria-label="جارٍ التحميل" />
    </div>
  );
}

export const Route = createFileRoute("/")({
  // Client-only: the session lives in localStorage, so the server can never
  // decide the destination — rendering it on the server just showed a blank page.
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/login" });
  },
  pendingComponent: Splash,
  component: Splash,
});
