import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, LoaderCircle } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | SchoolDesk" },
      { name: "description", content: "تسجيل الدخول الآمن إلى لوحة إدارة المدرسة SchoolDesk." },
      { property: "og:title", content: "تسجيل الدخول | SchoolDesk" },
      { property: "og:description", content: "تسجيل الدخول الآمن إلى لوحة إدارة المدرسة SchoolDesk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

/** Only same-origin relative paths are safe redirect targets. */
function safeNext(next?: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (target) window.location.href = target;
        else navigate({ to: "/dashboard" });
      }
    });
  }, [navigate, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("LOGIN_TIMEOUT")), 15000);
        }),
      ]);
      if (error) throw error;
      toast.success("مرحباً بعودتك");
      if (target) window.location.href = target;
      else navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      const friendly = /invalid login|invalid_credentials/i.test(msg)
        ? "بريد إلكتروني أو كلمة مرور غير صحيحة"
        : /LOGIN_TIMEOUT/i.test(msg)
          ? "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت وحاول مرة أخرى."
        : /email not confirmed/i.test(msg)
          ? "لم يتم تأكيد البريد الإلكتروني بعد"
          : msg;
      setError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">SchoolDesk</h1>
            <p className="text-sm text-muted-foreground">لوحة إدارة المدرسة</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>تسجيل الدخول</CardTitle>
            <CardDescription>أدخل بياناتك للوصول إلى لوحة التحكم</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={!ready || loading}>
                {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {loading ? "جارٍ تسجيل الدخول" : "دخول"}
              </Button>

            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          الحسابات تُنشأ من قِبل مدير النظام فقط — راجع الإدارة للحصول على حساب.
        </p>

      </div>
    </div>
  );
}
