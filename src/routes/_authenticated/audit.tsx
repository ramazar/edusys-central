import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/audit")({ component: AuditPage });

function AuditPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">سجل المراجعة</h1>
        <p className="text-sm text-muted-foreground">تاريخ كامل لكل الإجراءات على النظام</p>
      </div>

      <Card>
        <CardHeader><CardTitle>آخر 500 إجراء</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">المستخدم</TableHead>
            <TableHead className="text-right">الإجراء</TableHead>
            <TableHead className="text-right">الوحدة</TableHead>
            <TableHead className="text-right">المعرف</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد سجلات</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("ar")}</TableCell>
                <TableCell>{l.user_email || "—"}</TableCell>
                <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                <TableCell>{l.module}</TableCell>
                <TableCell className="font-mono text-xs">{l.entity_id?.slice(0, 8) || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
