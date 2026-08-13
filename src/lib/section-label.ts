export type SectionGender = "boys" | "girls";

export function genderLabel(gender?: string | null): string {
  return gender === "girls" ? "بنات" : "بنين";
}

/** «الشعبة 2 (بنات)» */
export function sectionLabel(sectionNumber?: number | string | null, gender?: string | null): string {
  const num = sectionNumber ?? "—";
  return `الشعبة ${num} (${genderLabel(gender)})`;
}

/** «الصف 5 · الشعبة 2 (بنات)» */
export function gradeSectionLabel(
  gradeId?: number | string | null,
  sectionNumber?: number | string | null,
  gender?: string | null,
): string {
  return `الصف ${gradeId ?? "—"} · ${sectionLabel(sectionNumber, gender)}`;
}
