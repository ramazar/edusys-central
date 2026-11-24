import { addMonths, startOfMonth } from "date-fns";

/** Half-open calendar month range: from is included, to is excluded. */
export function monthRange(now: Date): { from: string; to: string } {
  const start = startOfMonth(now);
  return {
    from: start.toISOString().slice(0, 10),
    to: addMonths(start, 1).toISOString().slice(0, 10),
  };
}
