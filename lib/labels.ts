import type { Muscle } from "@/lib/program-seed";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  back_lat: "หลัง",
  shoulders: "ไหล่",
  chest: "อก",
  legs: "ขา",
  arms: "แขน",
  core: "แกนกลาง",
  glutes: "ก้น",
  cardio: "คาร์ดิโอ",
  neck: "คอ",
};

/**
 * Tag tint per focus group. The label text always carries the meaning —
 * colour never does the work alone (Report/03-ui-spec.md §8).
 */
export const MUSCLE_TAG_CLASS: Record<Muscle, string> = {
  back_lat: "bg-s3/15 text-s3",
  shoulders: "bg-s1/15 text-s1",
  chest: "bg-s1/15 text-s1",
  legs: "bg-s2/15 text-s2",
  glutes: "bg-s2/15 text-s2",
  arms: "bg-s1/15 text-s1",
  core: "bg-s1/15 text-s1",
  cardio: "bg-s2/15 text-s2",
  neck: "bg-surface-2 text-text-2",
};

export const isMuscle = (v: string): v is Muscle => v in MUSCLE_LABEL;

export const focusLabel = (v: string) => (isMuscle(v) ? MUSCLE_LABEL[v] : v);

export const focusTagClass = (v: string) =>
  isMuscle(v) ? MUSCLE_TAG_CLASS[v] : "bg-surface-2 text-label";

/** `52 นาที`, `1 ชม. 4 นาที` */
export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} ชม.` : `${h} ชม. ${rem} นาที`;
}

export const formatKg = (kg: number) =>
  `${kg.toLocaleString("en-US", { maximumFractionDigits: 0 })} kg`;
