// A mark must be between 0 and its top mark (العلامة القصوى). Returns an
// Arabic error message, or null when the mark is valid.
export function markScoreError(score: number, maxScore: number): string | null {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return "العلامة القصوى يجب أن تكون أكبر من صفر";
  if (!Number.isFinite(score)) return "يرجى إدخال علامة صحيحة";
  if (score < 0) return "العلامة لا يمكن أن تكون أقل من صفر";
  if (score > maxScore) return `العلامة (${score}) أكبر من العلامة القصوى (${maxScore})`;
  return null;
}
