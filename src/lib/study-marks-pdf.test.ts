import { describe, expect, it } from "vitest";
import { filterStudyMarks } from "./study-marks-pdf";

const mark = (date: string, mark_type: string | null = "study", max_score = 10) => ({
  date,
  mark_type,
  max_score,
});

describe("filterStudyMarks", () => {
  it("keeps only marks whose type is study", () => {
    const rows = [mark("2026-11-10", "study"), mark("2026-11-10", "exam"), mark("2026-11-10", null)];
    expect(filterStudyMarks(rows, "2026-11-01", "2026-11-30")).toEqual([rows[0]]);
  });

  it("includes both selected range boundaries and excludes dates outside them", () => {
    const rows = [
      mark("2026-10-31"),
      mark("2026-11-01"),
      mark("2026-11-15"),
      mark("2026-11-30"),
      mark("2026-12-01"),
    ];
    expect(filterStudyMarks(rows, "2026-11-01", "2026-11-30")).toEqual([rows[1], rows[2], rows[3]]);
  });

  it("does not export note-only rows as study marks", () => {
    const rows = [mark("2026-11-10", "study", 0), mark("2026-11-10", "study", 20)];
    expect(filterStudyMarks(rows, "2026-11-01", "2026-11-30")).toEqual([rows[1]]);
  });
});
