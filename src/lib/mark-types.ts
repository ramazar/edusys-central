export type MarkType =
  | "teacher_recitation"
  | "academic_supervision"
  | "probe"
  | "study"
  | "recitation"
  | "exam";

/** Ordered list of mark types shown in pickers and export groups. */
export const MARK_TYPES: { value: MarkType; label: string }[] = [
  { value: "teacher_recitation", label: "تسميع مدرس" },
  { value: "academic_supervision", label: "إشراف علمي" },
  { value: "probe", label: "سبر" },
  { value: "study", label: "مذاكرة" },
  { value: "recitation", label: "تسميع" },
  { value: "exam", label: "فحص" },
];

export const markTypeLabels = Object.fromEntries(
  MARK_TYPES.map((t) => [t.value, t.label]),
) as Record<MarkType, string>;

export const markTypeLabel = (t: MarkType | null | undefined) => (t ? markTypeLabels[t] : "غير مصنّف");
