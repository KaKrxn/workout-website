// FitTrack shared app helpers: i18n, theme, units, date format, nav config.
const LS = { locale: 'ft_locale', theme: 'ft_theme', units: 'ft_units', auth: 'ft_auth' };

export function getLocale() { return localStorage.getItem(LS.locale) || 'th'; }
export function setLocale(v) { localStorage.setItem(LS.locale, v); }
export function getUnits() { return localStorage.getItem(LS.units) || 'metric'; }
export function setUnits(v) { localStorage.setItem(LS.units, v); }
export function getTheme() { return localStorage.getItem(LS.theme) || 'dark'; }
export function setTheme(v) { localStorage.setItem(LS.theme, v); }

// Dark theme = override Modernist tokens on :root (system is light-only).
const DARK = {
  '--color-bg': '#181615', '--color-surface': '#242120', '--color-text': '#f3f2f2',
  '--color-divider': 'color-mix(in srgb, #f3f2f2 32%, transparent)',
  '--color-accent': '#ff563c', '--color-accent-600': '#ff7a63', '--color-accent-700': '#ff9483',
  '--color-neutral-100': '#2c2927', '--color-neutral-200': '#343130', '--color-neutral-800': '#d7d3d3', '--color-neutral-900': '#f3f2f2',
  '--color-accent-100': '#3a2320', '--color-accent-800': '#ffc4b8',
  '--shadow-sm': '0 1px 2px rgba(0,0,0,.5)', '--shadow-md': '0 3px 12px rgba(0,0,0,.55)', '--shadow-lg': '0 14px 40px rgba(0,0,0,.6)',
};
export function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-ft-theme', t);
  root.style.colorScheme = t;
}
// call once at page load, before paint
export function bootTheme() { applyTheme(getTheme()); document.documentElement.lang = getLocale(); }

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Theme switch with a circular reveal expanding from the toggle (View Transitions API; instant fallback)
export function switchTheme(t, origin) {
  const apply = () => { setTheme(t); applyTheme(t); window.dispatchEvent(new CustomEvent('ft-theme', { detail: t })); };
  if (!document.startViewTransition || reduceMotion()) { apply(); return; }
  let x = window.innerWidth - 60, y = 40;
  if (origin && origin.getBoundingClientRect) { const r = origin.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const vt = document.startViewTransition(apply);
  vt.ready.then(() => document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
    { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
  )).catch(() => {});
}
// Live language switch (no reload) — pages listen for 'ft-locale'; content fades/unblurs in
export function switchLocale(l) {
  setLocale(l); document.documentElement.lang = l;
  window.dispatchEvent(new CustomEvent('ft-locale', { detail: l }));
  if (reduceMotion()) return;
  document.querySelectorAll('main').forEach(m => m.animate && m.animate(
    [{ opacity: .25, transform: 'translateY(6px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }
  ));
}

// ── i18n ────────────────────────────────────────────────────────────────────
const DICT = {
  th: {
    'nav.today': 'วันนี้', 'nav.schedule': 'ตาราง', 'nav.analytics': 'สถิติ', 'nav.body': 'ร่างกาย',
    'nav.history': 'ประวัติ', 'nav.library': 'คลังท่า', 'nav.settings': 'ตั้งค่า', 'nav.admin': 'ผู้ดูแล', 'nav.logout': 'ออกจากระบบ',
    'cta.start': 'เริ่มเลย', 'cta.finish': 'จบเวิร์คเอาท์', 'cta.done': 'จบแล้ว', 'cta.save': 'บันทึก', 'cta.cancel': 'ยกเลิก', 'cta.add': 'เพิ่ม', 'cta.delete': 'ลบ', 'cta.signup': 'เริ่มใช้งานฟรี', 'cta.login': 'เข้าสู่ระบบ',
    'today.head': 'วันนี้', 'today.exercises': 'ท่าทั้งหมด', 'today.sets': 'เซ็ตรวม', 'today.logged': 'บันทึกแล้ว',
    'today.target': 'เป้าวันนี้', 'today.prev': 'ครั้งก่อน', 'today.rest': 'วันพักตามแผนไม่นับว่าพลาด และไม่ทำให้ streak ขาด',
    'today.swap': 'สลับโปรแกรม', 'today.progress': 'ความคืบหน้า', 'today.overload': 'พร้อมเพิ่มน้ำหนักแล้ว',
    'set.weight': 'น้ำหนัก', 'set.reps': 'ครั้ง', 'set.time': 'เวลา', 'set.dist': 'ระยะทาง', 'set.set': 'เซ็ต',
    'unit.kg': 'กก.', 'unit.min': 'นาที', 'unit.km': 'กม.', 'unit.sec': 'วิ', 'unit.reps': 'ครั้ง',
    'sched.head': 'ตารางสัปดาห์นี้', 'sched.repeat': 'ทำซ้ำทุกสัปดาห์', 'sched.addplan': 'เพิ่ม Plan', 'sched.savetpl': 'บันทึกเทมเพลต', 'sched.est': 'โดยประมาณ',
    'an.range.30': '30 วัน', 'an.range.90': '90 วัน', 'an.range.365': '1 ปี', 'an.range.all': 'ทั้งหมด',
    'an.streak': 'สตรีค', 'an.adherence': 'ทำได้ตามแผน', 'an.heatmap': 'ความสม่ำเสมอ', 'an.table': 'ดูเป็นตาราง', 'an.volume': 'ปริมาตรรวมรายสัปดาห์', 'an.days': 'จำนวนวันเทียบเป้า', 'an.split': 'สัดส่วนกลุ่มกล้ามเนื้อ', 'an.less': 'น้อย', 'an.more': 'มาก',
    'body.vtaper': 'V-Taper Ratio', 'body.bf': '% ไขมัน', 'body.weight': 'น้ำหนักตัว', 'body.shoulder': 'รอบไหล่', 'body.waist': 'รอบเอว', 'body.log': 'บันทึกสัดส่วน', 'body.note': 'วัดความก้าวหน้าด้วยสัดส่วน ไม่ใช่ตัวเลขบนตาชั่ง',
    'lib.search': 'ค้นหาท่า', 'lib.all': 'ทั้งหมด', 'lib.add': 'เพิ่มท่าของฉัน',
    'set.settings': 'ตั้งค่า', 'set.theme': 'ธีม', 'set.lang': 'ภาษา', 'set.unitsys': 'หน่วยวัด', 'set.goal': 'เป้าหมาย', 'set.equip': 'อุปกรณ์', 'set.light': 'สว่าง', 'set.dark': 'มืด', 'set.metric': 'เมตริก (กก.)', 'set.imperial': 'อิมพีเรียล (ปอนด์)',
    'hist.head': 'ประวัติ', 'hist.vol': 'ปริมาตร', 'hist.detail': 'รายละเอียด', 'hist.completed': 'เสร็จ', 'hist.missed': 'ไม่ได้ออก', 'hist.rest': 'วันพัก',
    'admin.head': 'ระบบผู้ดูแล', 'admin.health': 'สุขภาพระบบ', 'admin.users': 'ผู้ใช้', 'admin.logs': 'บันทึกเหตุการณ์', 'admin.cron': 'สถานะ Cron', 'admin.run': 'รันซ้ำ',
    'land.tagline': 'ตารางที่คุณออกแบบเอง วิ่งต่อให้เองทุกเดือน', 'land.sub': 'และพิสูจน์ให้เห็นว่าคุณสม่ำเสมอจริง',
    'auth.email': 'อีเมล', 'auth.pw': 'รหัสผ่าน', 'auth.google': 'เข้าสู่ระบบด้วย Google', 'auth.or': 'หรือ', 'auth.haveacc': 'มีบัญชีอยู่แล้ว', 'auth.noacc': 'ยังไม่มีบัญชี',
    'week.mon': 'จ', 'week.tue': 'อ', 'week.wed': 'พ', 'week.thu': 'พฤ', 'week.fri': 'ศ', 'week.sat': 'ส', 'week.sun': 'อา',
  },
  en: {
    'nav.today': 'Today', 'nav.schedule': 'Schedule', 'nav.analytics': 'Analytics', 'nav.body': 'Body',
    'nav.history': 'History', 'nav.library': 'Library', 'nav.settings': 'Settings', 'nav.admin': 'Admin', 'nav.logout': 'Log out',
    'cta.start': 'Start', 'cta.finish': 'Finish workout', 'cta.done': 'Done', 'cta.save': 'Save', 'cta.cancel': 'Cancel', 'cta.add': 'Add', 'cta.delete': 'Delete', 'cta.signup': 'Start free', 'cta.login': 'Log in',
    'today.head': 'Today', 'today.exercises': 'Exercises', 'today.sets': 'Total sets', 'today.logged': 'Logged',
    'today.target': "Today's target", 'today.prev': 'Last time', 'today.rest': "A planned rest day doesn't count as a miss, and won't break your streak.",
    'today.swap': 'Swap program', 'today.progress': 'Progress', 'today.overload': 'Ready to add weight',
    'set.weight': 'Weight', 'set.reps': 'Reps', 'set.time': 'Time', 'set.dist': 'Distance', 'set.set': 'Set',
    'unit.kg': 'kg', 'unit.min': 'min', 'unit.km': 'km', 'unit.sec': 's', 'unit.reps': 'reps',
    'sched.head': 'This week', 'sched.repeat': 'repeats every week', 'sched.addplan': 'Add plan', 'sched.savetpl': 'Save template', 'sched.est': 'approx',
    'an.range.30': '30 days', 'an.range.90': '90 days', 'an.range.365': '1 year', 'an.range.all': 'All',
    'an.streak': 'Streak', 'an.adherence': 'Plan adherence', 'an.heatmap': 'Consistency', 'an.table': 'View as table', 'an.volume': 'Weekly total volume', 'an.days': 'Days vs target', 'an.split': 'Muscle-group split', 'an.less': 'Less', 'an.more': 'More',
    'body.vtaper': 'V-Taper Ratio', 'body.bf': 'Body fat %', 'body.weight': 'Body weight', 'body.shoulder': 'Shoulder', 'body.waist': 'Waist', 'body.log': 'Log measurement', 'body.note': 'We measure progress by proportion, not the number on the scale.',
    'lib.search': 'Search exercises', 'lib.all': 'All', 'lib.add': 'Add my exercise',
    'set.settings': 'Settings', 'set.theme': 'Theme', 'set.lang': 'Language', 'set.unitsys': 'Units', 'set.goal': 'Goal', 'set.equip': 'Equipment', 'set.light': 'Light', 'set.dark': 'Dark', 'set.metric': 'Metric (kg)', 'set.imperial': 'Imperial (lb)',
    'hist.head': 'History', 'hist.vol': 'Volume', 'hist.detail': 'Detail', 'hist.completed': 'Completed', 'hist.missed': 'Missed', 'hist.rest': 'Rest',
    'admin.head': 'Admin console', 'admin.health': 'System health', 'admin.users': 'Users', 'admin.logs': 'Audit log', 'admin.cron': 'Cron status', 'admin.run': 'Re-run',
    'land.tagline': 'A schedule you design once — it keeps running for you every month', 'land.sub': 'and proves you were actually consistent.',
    'auth.email': 'Email', 'auth.pw': 'Password', 'auth.google': 'Continue with Google', 'auth.or': 'or', 'auth.haveacc': 'Already have an account', 'auth.noacc': "Don't have an account",
    'week.mon': 'Mon', 'week.tue': 'Tue', 'week.wed': 'Wed', 'week.thu': 'Thu', 'week.fri': 'Fri', 'week.sat': 'Sat', 'week.sun': 'Sun',
  },
};
export function makeT(locale) { const d = DICT[locale] || DICT.th; return k => d[k] ?? k; }

// group label by locale
export function groupLabel(groups, g, locale) { const x = groups[g]; return x ? (locale === 'en' ? x.en : x.th) : g; }

// ── dates ────────────────────────────────────────────────────────────────────
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EN_DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function fmtLongDate(d, locale) {
  if (locale === 'en') return `${EN_DOW[d.getDay()]} ${d.getDate()} ${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `วัน${TH_DOW[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
export function fmtShortDate(iso, locale) {
  const d = new Date(iso);
  if (locale === 'en') return `${d.getDate()} ${EN_MONTHS[d.getMonth()].slice(0,3)}`;
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()].slice(0,3)}`;
}
export function isoWeek(d) { const t = new Date(d); t.setHours(0,0,0,0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); const w1 = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); }

// weight display honoring units (kg <-> lb)
export function fmtWeight(kg, units) { if (kg == null) return '—'; if (units === 'imperial') return `${Math.round(kg * 2.20462 * 2) / 2} lb`; return `${kg} kg`; }

// ── nav config ────────────────────────────────────────────────────────────────
export const MAIN_NAV = [
  { id: 'today', href: 'App.dc.html#today', icon: 'target' },
  { id: 'schedule', href: 'App.dc.html#schedule', icon: 'calendar' },
  { id: 'analytics', href: 'App.dc.html#analytics', icon: 'bar-chart-3' },
  { id: 'body', href: 'App.dc.html#body', icon: 'activity' },
];
export const MORE_NAV = [
  { id: 'history', href: 'App.dc.html#history', icon: 'history' },
  { id: 'library', href: 'App.dc.html#library', icon: 'dumbbell' },
  { id: 'settings', href: 'App.dc.html#settings', icon: 'settings' },
  { id: 'admin', href: 'App.dc.html#admin', icon: 'shield' },
];

// responsive helper
// Breakpoints: mobile <640 · tablet 640–1099 · desktop ≥1100
export function getBP() { const w = window.innerWidth; return w < 640 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop'; }
export function watchBP(cb) {
  let last = null; const fn = () => { const bp = getBP(); if (bp !== last) { last = bp; cb(bp); } };
  fn(); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn);
}
// cb(isMobile, bp) — isMobile = phone layout; bp lets pages treat tablet separately
export function watchMobile(cb) { return watchBP(bp => cb(bp === 'mobile', bp)); }
