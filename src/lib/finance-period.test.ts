import { describe, expect, it } from "vitest";
import { monthRange } from "./finance-period";

describe("monthRange", () => {
  it("limits November 2026 revenue to November and excludes December", () => {
    expect(monthRange(new Date("2026-11-24T12:00:00Z"))).toEqual({
      from: "2026-11-01",
      to: "2026-12-01",
    });
  });

  it("crosses the year boundary without including next January", () => {
    expect(monthRange(new Date("2026-12-17T12:00:00Z"))).toEqual({
      from: "2026-12-01",
      to: "2027-01-01",
    });
  });
});
