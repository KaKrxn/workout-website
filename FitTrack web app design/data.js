// FitTrack mockup data — persona: Ken (V-Taper goal, dumbbell Program B)
// Deterministic: history is generated from a seeded PRNG so every page agrees.

// ── muscle groups (mono-system: neutral dots, accent for priority) ──────────
export const GROUPS = {
  chest:     { th: 'อก',      en: 'Chest' },
  back:      { th: 'หลัง',    en: 'Back' },
  shoulders: { th: 'ไหล่',    en: 'Shoulders' },
  legs:      { th: 'ขา',      en: 'Legs' },
  arms:      { th: 'แขน',     en: 'Arms' },
  core:      { th: 'แกนกลาง', en: 'Core' },
  cardio:    { th: 'คาร์ดิโอ', en: 'Cardio' },
};

// ── exercise library (41) ───────────────────────────────────────────────────
// type: strength | bodyweight | duration | cardio ; unilateral = per-side
function ex(id, th, en, group, type, low, high, opts = {}) {
  return { id, th, en, group, type, low, high, unilateral: !!opts.uni, custom: !!opts.custom, equip: opts.equip || 'dumbbell' };
}
export const EXERCISES = [
  // chest
  ex('db-bench',      'ดัมเบลเบนช์เพรส',       'DB Bench Press',        'chest', 'strength', 8, 12),
  ex('db-incline',    'ดัมเบลอินไคลน์เพรส',    'DB Incline Press',      'chest', 'strength', 8, 12),
  ex('db-fly',        'ดัมเบลฟลาย',            'DB Fly',                'chest', 'strength', 10, 15),
  ex('pushup',        'วิดพื้น',               'Push-up',               'chest', 'bodyweight', 8, 20, { equip: 'none' }),
  ex('pushup-deficit','วิดพื้นยกสูง',          'Deficit Push-up',       'chest', 'bodyweight', 8, 15, { equip: 'none' }),
  // back
  ex('db-row',        'ดัมเบลโรว์',            'DB Row',                'back', 'strength', 8, 12, { uni: true }),
  ex('db-pullover',   'ดัมเบลพูลโอเวอร์',      'DB Pullover',           'back', 'strength', 10, 15),
  ex('db-rdl',        'ดัมเบล RDL',            'DB Romanian Deadlift',  'back', 'strength', 8, 12),
  ex('superman',      'ซูเปอร์แมน',            'Superman',              'back', 'bodyweight', 10, 20, { equip: 'none' }),
  ex('rev-fly',       'ดัมเบลรีเวิร์สฟลาย',    'DB Reverse Fly',        'back', 'strength', 12, 18),
  // shoulders
  ex('db-ohp',        'ดัมเบลโอเวอร์เฮดเพรส',  'DB Overhead Press',     'shoulders', 'strength', 8, 12),
  ex('db-lateral',    'ดัมเบลข้างลำตัว',       'DB Lateral Raise',      'shoulders', 'strength', 12, 18),
  ex('db-front',      'ดัมเบลยกหน้า',          'DB Front Raise',        'shoulders', 'strength', 10, 15),
  ex('db-arnold',     'อาร์โนลด์เพรส',         'Arnold Press',          'shoulders', 'strength', 8, 12),
  ex('pike-pushup',   'ไพค์พุชอัพ',            'Pike Push-up',          'shoulders', 'bodyweight', 6, 12, { equip: 'none' }),
  // legs
  ex('db-goblet',     'กอเบล็ตสควอต',          'Goblet Squat',          'legs', 'strength', 10, 15),
  ex('db-lunge',      'ดัมเบลลันจ์',           'DB Lunge',              'legs', 'strength', 8, 12, { uni: true }),
  ex('db-bulgarian',  'บัลแกเรียนสควอต',       'Bulgarian Split Squat', 'legs', 'strength', 8, 12, { uni: true }),
  ex('db-calf',       'ดัมเบลเขย่งน่อง',       'DB Calf Raise',         'legs', 'strength', 15, 25),
  ex('wall-sit',      'วอลล์ซิต',              'Wall Sit',              'legs', 'duration', 30, 90, { equip: 'none' }),
  ex('bw-squat',      'สควอตตัวเปล่า',         'Bodyweight Squat',      'legs', 'bodyweight', 15, 30, { equip: 'none' }),
  ex('glute-bridge',  'กลูตบริดจ์',            'Glute Bridge',          'legs', 'bodyweight', 12, 25, { equip: 'none' }),
  // arms
  ex('db-curl',       'ดัมเบลม้วนแขน',         'DB Biceps Curl',        'arms', 'strength', 10, 15),
  ex('db-hammer',     'แฮมเมอร์เคิร์ล',        'Hammer Curl',           'arms', 'strength', 10, 15),
  ex('db-tri-ext',    'ดัมเบลเหยียดแขน',       'DB Triceps Extension',  'arms', 'strength', 10, 15),
  ex('db-kickback',   'ดัมเบลคิกแบ็ก',         'DB Kickback',           'arms', 'strength', 12, 18, { uni: true }),
  ex('dip-chair',     'ดิปเก้าอี้',            'Chair Dip',             'arms', 'bodyweight', 8, 15, { equip: 'none' }),
  ex('db-conc',       'คอนเซนเทรชันเคิร์ล',    'Concentration Curl',    'arms', 'strength', 10, 15, { uni: true }),
  // core
  ex('plank',         'แพลงก์',                'Plank',                 'core', 'duration', 30, 90, { equip: 'none' }),
  ex('side-plank',    'ไซด์แพลงก์',            'Side Plank',            'core', 'duration', 20, 60, { equip: 'none', uni: true }),
  ex('db-crunch',     'ดัมเบลครันช์',          'Weighted Crunch',       'core', 'strength', 12, 20),
  ex('leg-raise',     'ยกขา',                  'Leg Raise',             'core', 'bodyweight', 10, 20, { equip: 'none' }),
  ex('russian-twist', 'รัสเซียนทวิสต์',        'Russian Twist',         'core', 'strength', 16, 30),
  ex('deadbug',       'เดดบั๊ก',               'Dead Bug',              'core', 'bodyweight', 10, 16, { equip: 'none' }),
  ex('hollow-hold',   'ฮอลโลว์โฮลด์',          'Hollow Hold',           'core', 'duration', 20, 50, { equip: 'none' }),
  // cardio
  ex('run',           'วิ่ง',                  'Run',                   'cardio', 'cardio', 0, 0, { equip: 'none' }),
  ex('jump-rope',     'กระโดดเชือก',           'Jump Rope',             'cardio', 'cardio', 0, 0, { equip: 'none' }),
  ex('cycling',       'ปั่นจักรยาน',           'Cycling',               'cardio', 'cardio', 0, 0, { equip: 'none' }),
  ex('incline-walk',  'เดินขึ้นเนิน',          'Incline Walk',          'cardio', 'cardio', 0, 0, { equip: 'none' }),
  ex('hiit',          'HIIT',                  'HIIT Circuit',          'cardio', 'cardio', 0, 0, { equip: 'none' }),
  ex('burpee',        'เบอร์พี',               'Burpee',                'cardio', 'bodyweight', 10, 20, { equip: 'none' }),
];
export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// ── 7-day template (Program B = dumbbell, active) ───────────────────────────
// dow 0=Mon..6=Sun. priority marks V-Taper focus days.
function item(exId, sets, opts = {}) {
  const e = EX_BY_ID[exId];
  return { exId, sets, low: opts.low ?? e.low, high: opts.high ?? e.high, weight: opts.weight ?? null, primary: !!opts.primary };
}
export const TEMPLATE = [
  { dow: 0, rest: false, name: { th: 'ดันตัว — อก + ไหล่ + แขนหลัง', en: 'Push — Chest + Shoulders + Triceps' }, groups: ['chest','shoulders','arms'],
    items: [ item('db-bench',4,{weight:15}), item('db-incline',3,{weight:12.5}), item('db-ohp',4,{weight:10}), item('db-lateral',3,{weight:6}), item('db-tri-ext',3,{weight:10}) ] },
  { dow: 1, rest: false, name: { th: 'คาร์ดิโอ', en: 'Cardio' }, groups: ['cardio'],
    items: [ item('run',1), item('jump-rope',3) ] },
  { dow: 2, rest: false, name: { th: 'ดึง — หลัง + แขนหน้า', en: 'Pull — Back + Biceps' }, groups: ['back','arms'],
    items: [ item('db-row',4,{weight:17.5,primary:true}), item('db-rdl',4,{weight:20}), item('db-pullover',3,{weight:15}), item('db-curl',3,{weight:12.5}), item('db-hammer',3,{weight:10}) ] },
  { dow: 3, rest: false, name: { th: 'ขา + แกนกลาง', en: 'Legs + Core' }, groups: ['legs','core'],
    items: [ item('db-goblet',4,{weight:22.5}), item('db-bulgarian',3,{weight:12.5}), item('db-rdl',3,{weight:20}), item('db-calf',4,{weight:20}), item('plank',3) ] },
  { dow: 4, rest: false, priority: true, name: { th: 'ไหล่ + หลัง (วัน V-Taper)', en: 'Shoulders + Back (V-Taper day)' }, groups: ['shoulders','back'],
    items: [ item('db-ohp',4,{weight:12.5,primary:true}), item('db-lateral',4,{weight:7.5,primary:true}), item('db-row',4,{weight:17.5}), item('rev-fly',3,{weight:6}), item('db-front',3,{weight:6}) ] },
  { dow: 5, rest: false, name: { th: 'คาร์ดิโอ + แกนกลาง', en: 'Cardio + Core' }, groups: ['cardio','core'],
    items: [ item('incline-walk',1), item('hollow-hold',3), item('russian-twist',3,{weight:8}) ] },
  { dow: 6, rest: true, name: { th: 'วันพัก', en: 'Rest day' }, groups: [], items: [] },
];

// alternate Plan A (no-equipment) available on some days
export const PLAN_A = {
  0: { name: { th: 'ดันตัว — ไม่ใช้อุปกรณ์', en: 'Push — No equipment' }, groups: ['chest','shoulders','arms'],
       items: [ item('pushup',4), item('pike-pushup',4), item('pushup-deficit',3), item('dip-chair',3) ] },
  4: { name: { th: 'ไหล่ + หลัง — ไม่ใช้อุปกรณ์', en: 'Shoulders + Back — No equipment' }, groups: ['shoulders','back'],
       items: [ item('pike-pushup',4,{primary:true}), item('superman',4), item('pushup',3), item('side-plank',3) ] },
};

// ── deterministic PRNG (mulberry32) ─────────────────────────────────────────
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// "Today" is fixed to Fri 14 Aug 2026 (week 33) per the GDD.
export const TODAY = new Date(2026, 7, 14); // month 7 = August
export function dowOf(d) { return (d.getDay() + 6) % 7; } // Mon=0

// ── history: ~9 weeks of completed sessions ending yesterday ────────────────
function ymd(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function buildHistory() {
  const r = rng(33033);
  const sessions = [];
  const stats = {};
  const START_BACK = 63; // 9 weeks
  for (let back = START_BACK; back >= 1; back--) {
    const d = new Date(TODAY); d.setDate(d.getDate() - back);
    const dow = dowOf(d);
    const day = TEMPLATE[dow];
    if (day.rest) { stats[ymd(d)] = { rest: true, vol: 0, level: 0 }; continue; }
    // skip ~12% of days (missed) — but never mark as failure
    const missed = r() < 0.12 && back > 3;
    if (missed) { stats[ymd(d)] = { rest: false, vol: 0, level: 0, missed: true }; continue; }
    const items = day.items;
    const weeksAgo = Math.floor(back / 7);
    let totalVol = 0; const loggedItems = [];
    for (const it of items) {
      const e = EX_BY_ID[it.exId];
      const setsLogged = [];
      for (let s = 0; s < it.sets; s++) {
        if (e.type === 'strength') {
          // progressive: weight climbs slightly over the weeks
          const w = (it.weight || 10) - Math.min(weeksAgo, 7) * 0.6;
          const wr = Math.max(5, Math.round(w / 2.5) * 2.5);
          const reps = Math.round(it.low + r() * (it.high - it.low));
          setsLogged.push({ weight: wr, reps });
          totalVol += wr * reps;
        } else if (e.type === 'bodyweight') {
          const reps = Math.round(it.low + r() * (it.high - it.low)) - weeksAgo;
          setsLogged.push({ reps: Math.max(it.low, reps) });
          totalVol += Math.max(it.low, reps) * 40;
        } else if (e.type === 'duration') {
          const sec = Math.round(it.low + r() * (it.high - it.low));
          setsLogged.push({ sec });
          totalVol += sec * 5;
        } else { // cardio
          const min = 15 + Math.round(r() * 25), dist = +(2 + r() * 4).toFixed(1);
          setsLogged.push({ min, dist });
          totalVol += min * 30;
        }
      }
      loggedItems.push({ exId: it.exId, sets: setsLogged });
    }
    const level = Math.min(4, 1 + Math.floor(totalVol / 3200));
    stats[ymd(d)] = { rest: false, vol: Math.round(totalVol), level };
    sessions.push({ id: 's' + back, date: ymd(d), dow, name: day.name, groups: day.groups, vol: Math.round(totalVol), items: loggedItems, status: 'completed' });
  }
  return { sessions: sessions.reverse(), stats };
}
const H = buildHistory();
export const HISTORY = H.sessions;
export const DAILY_STATS = H.stats;

// ── "previous" lookup for progressive overload on Today ─────────────────────
export function lastResultFor(exId) {
  for (let i = HISTORY.length - 1; i >= 0; i--) {
    const hit = HISTORY[i].items.find(it => it.exId === exId);
    if (hit) return { date: HISTORY[i].date, sets: hit.sets };
  }
  return null;
}

// ── body metrics: weekly, V-Taper improving ────────────────────────────────
export const BODY_METRICS = (() => {
  const r = rng(9001); const out = [];
  for (let w = 8; w >= 0; w--) {
    const d = new Date(TODAY); d.setDate(d.getDate() - w * 7);
    const shoulder = 118 + (8 - w) * 0.6 + (r() - 0.5); // cm
    const waist = 82 - (8 - w) * 0.5 + (r() - 0.5);
    const weight = 72.5 - (8 - w) * 0.15 + (r() - 0.5) * 0.6;
    const bf = 19.5 - (8 - w) * 0.35 + (r() - 0.5) * 0.4;
    out.push({ date: ymd(d), shoulder: +shoulder.toFixed(1), waist: +waist.toFixed(1), weight: +weight.toFixed(1), bf: +bf.toFixed(1), vtaper: +(shoulder / waist).toFixed(3) });
  }
  return out;
})();

// ── weekly volume series (last 9 weeks) for analytics ───────────────────────
export const WEEKLY = (() => {
  const weeks = {};
  for (const s of HISTORY) {
    const d = new Date(s.date); const wk = Math.floor((TODAY - d) / (7 * 864e5));
    weeks[wk] = weeks[wk] || { vol: 0, days: 0 };
    weeks[wk].vol += s.vol; weeks[wk].days += 1;
  }
  const out = [];
  for (let w = 8; w >= 0; w--) { const x = weeks[w] || { vol: 0, days: 0 }; out.push({ wkBack: w, vol: x.vol, days: x.days, target: 5 }); }
  return out;
})();

// ── muscle-group split for current week ─────────────────────────────────────
export const GROUP_SPLIT = (() => {
  const c = {};
  for (const day of TEMPLATE) for (const g of day.groups) c[g] = (c[g] || 0) + day.items.filter(i => EX_BY_ID[i.exId].group === g).length;
  return c;
})();

// summary stats for tiles
export const SUMMARY = {
  vtaper: BODY_METRICS[BODY_METRICS.length - 1].vtaper,
  vtaperPrev: BODY_METRICS[0].vtaper,
  bf: BODY_METRICS[BODY_METRICS.length - 1].bf,
  bfPrev: BODY_METRICS[0].bf,
  streak: 5,
  adherence: 0.82,
};
