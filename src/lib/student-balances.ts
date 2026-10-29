// What each student still owes: their whole payment plan minus what they paid.
// Payment plans have no currency column (they are always SYP), so only SYP
// payments are netted against them.

export type BalanceRow = {
  studentId: string;
  totalFee: number;
  paid: number;
  remaining: number;
};

export function computeBalances(
  plans: { student_id: string; amount: number | string }[],
  payments: { student_id: string; amount: number | string; currency: string | null }[],
): BalanceRow[] {
  const fees = new Map<string, number>();
  for (const p of plans) fees.set(p.student_id, (fees.get(p.student_id) ?? 0) + Number(p.amount));

  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.currency === "USD") continue;
    paid.set(p.student_id, (paid.get(p.student_id) ?? 0) + Number(p.amount));
  }

  const rows: BalanceRow[] = [];
  for (const [studentId, totalFee] of fees) {
    const p = paid.get(studentId) ?? 0;
    const remaining = totalFee - p;
    if (remaining > 0) rows.push({ studentId, totalFee, paid: p, remaining });
  }
  return rows.sort((a, b) => b.remaining - a.remaining);
}
