import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, LineChart } from "recharts";

type MonthRow = { month: string; income: number; expense: number };

export default function FinanceCharts({ monthly }: { monthly: MonthRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>الإيرادات مقابل المصروفات</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" reversed />
              <YAxis orientation="right" />
              <Tooltip />
              <Bar dataKey="income" fill="oklch(0.65 0.16 155)" name="إيرادات" />
              <Bar dataKey="expense" fill="oklch(0.585 0.22 27)" name="مصروفات" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>صافي الربح الشهري</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly.map((m) => ({ month: m.month, net: m.income - m.expense }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" reversed />
              <YAxis orientation="right" />
              <Tooltip />
              <Line type="monotone" dataKey="net" stroke="oklch(0.478 0.203 262)" strokeWidth={2} name="الصافي" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
