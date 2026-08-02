import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, Phone, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/developer")({
  component: DeveloperPage,
  head: () => ({
    meta: [
      { title: "عن المطوّر — SchoolDesk" },
      {
        name: "description",
        content: "تم تصميم وتطوير نظام SchoolDesk بالكامل بواسطة رام عازر الزهر — للدعم والمساندة.",
      },
      { property: "og:title", content: "عن المطوّر — SchoolDesk" },
      {
        property: "og:description",
        content: "تم تصميم وتطوير نظام SchoolDesk بالكامل بواسطة رام عازر الزهر — للدعم والمساندة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PHONES = ["0964782596", "0980162900"];

function DeveloperPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">عن المطوّر</h1>
        <p className="text-sm text-muted-foreground">معلومات التطوير والدعم الفني للنظام.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4" /> رام عازر الزهر
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="leading-relaxed">
            تم بناء وتصميم هذا النظام بالكامل بواسطة{" "}
            <span className="font-bold">رام عازر الزهر</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            للمساعدة والدعم الفني، يُرجى التواصل على أحد الرقمين التاليين:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PHONES.map((p) => (
              <div
                key={p}
                className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <span dir="ltr" className="font-mono text-base font-semibold">
                  {p}
                </span>
                <div className="flex gap-1">
                  <Button asChild size="icon" variant="ghost" aria-label={`اتصال ${p}`}>
                    <a href={`tel:${p}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label={`واتساب ${p}`}>
                    <a
                      href={`https://wa.me/963${p.replace(/^0/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
