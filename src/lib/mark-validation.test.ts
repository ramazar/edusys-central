import { describe, expect, it } from "vitest";
import { markScoreError, markSaveErrorMessage } from "./mark-validation";

describe("mark score limit", () => {
  it("refuses a score above the top mark (40 out of 10)", () => {
    expect(markScoreError(40, 10)).not.toBeNull();
  });
  it("refuses a score below zero", () => {
    expect(markScoreError(-1, 10)).not.toBeNull();
  });
  it("accepts a score equal to the top mark", () => {
    expect(markScoreError(10, 10)).toBeNull();
  });
  it("accepts zero", () => {
    expect(markScoreError(0, 10)).toBeNull();
  });
  it("turns the database refusal into the Arabic message", () => {
    const msg = markSaveErrorMessage({
      message: 'new row for relation "daily_marks" violates check constraint "daily_marks_score_within_max"',
    });
    expect(msg).not.toContain("daily_marks_score_within_max");
  });
});
