/**
 * Date helpers.
 *
 * Everything the app schedules is a *calendar* date (a workout belongs to a day,
 * not to an instant), so these operate on local dates and serialise as
 * `YYYY-MM-DD`. Never use `toISOString()` for this — it converts to UTC and
 * silently shifts the date by one for anyone east of Greenwich, which includes
 * this app's entire audience.
 */

/** `YYYY-MM-DD` in local time. */
export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses `YYYY-MM-DD` as a local date, not a UTC instant. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Monday of the week containing `d`. Week start is Monday by default (user_settings.week_start). */
export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0 = Sunday
  out.setDate(out.getDate() - (dow === 0 ? 6 : dow - 1));
  return out;
}

export function todayISO(): string {
  return formatISODate(new Date());
}

/** ISO-8601 week number, used for the "week 33" label in the Today header. */
export function isoWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Thursday of the current week determines the year the week belongs to.
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export const THAI_DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const THAI_DAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** `14 ส.ค. 2026` — years are Gregorian, matching the mockup. */
export const formatThaiShort = (d: Date) =>
  `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;

/** `14 สิงหาคม 2026` */
export const formatThaiLong = (d: Date) =>
  `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
