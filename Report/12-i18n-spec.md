# 12 — Bilingual UI (Thai + English)

Resolves the open decision in `11-end-to-end-plan.md` §2.5.

**The decision:** the app supports **both Thai and English**. **Headings are always English**, in
both languages. Everything else is translated.

---

## 1. The rule

This is deliberately not "translate everything". Headings, navigation and column labels stay
English in both locales; the words a user reads *as sentences* switch.

| Element | Thai locale | English locale |
|---|---|---|
| Page title (`h1`) | **English** | English |
| Section heading (`h2`, `h3`) | **English** | English |
| Nav tab / bottom-bar label | **English** | English |
| Table column header | **English** | English |
| Stat-tile label | **English** | English |
| Chart title and axis label | **English** | English |
| Body copy, help text, descriptions | Thai | English |
| Button label | Thai | English |
| Form field label | Thai | English |
| Placeholder | Thai | English |
| Validation and error message | Thai | English |
| Empty state | Thai | English |
| Toast / confirm dialog | Thai | English |
| Email (confirmation, password reset) | Thai | English |

**Worked example — the Today page in the Thai locale:**

```
Today — อก + หลัง + ไหล่          ← "Today" is a heading; the day label is user data
วันศุกร์ที่ 14 สิงหาคม 2026 · สัปดาห์ที่ 33

Exercises  7      Sets  24      Progress  29%     ← tile labels, English

Progress today 29%
─────────────────────────────────────────
  Dumbbell Bench Press                      ← exercise name, never translated
  4 เซ็ต × 8–12 ครั้ง · 12.5 kg              ← body copy, Thai
  ▸ เป้าวันนี้ 12 / 11 / 10 / 9

  [ น้ำหนัก ] [ ครั้ง ]  ✓                   ← field labels, Thai

  จบเวิร์คเอาท์                              ← button, Thai
```

### 1.1 What is never translated

**User data is not UI text.** These pass through untouched in both locales:

- Exercise names — `Dumbbell Bench Press` stays as it is. They are standard lift names, the seed
  stores them once, and translating them would break every reference in the training literature
  the user is following.
- Plan names, variant labels, day labels (`อก + หลัง + ไหล่`), notes, custom exercises the user
  created.
- Numbers and measured values.

The rule: if it lives in a database column the user can edit, it is not translated.

### 1.2 The one judgement call to confirm

Form field labels (`น้ำหนัก` / `Weight`, `ครั้ง` / `Reps`) are treated as **translated**, not as
headings — they sit inside a form rather than titling a region. If the intent was for these short
labels to be English too, it is a one-line change in the dictionary boundary.

---

## 2. Storage and resolution

Locale is **per user**, not per URL. Every authenticated page is already `force-dynamic`, so there
is no reason to fork the routing into `/th/...` and `/en/...` — that would double every path for no
benefit and break existing links.

```
Signed in    →  user_settings.locale
Signed out   →  `locale` cookie
No cookie    →  Accept-Language header ("th" → th, otherwise en)
Fallback     →  th
```

Changing the language in Settings writes `user_settings.locale` **and** the cookie, so the login
page keeps speaking the same language after a sign-out.

### 2.1 Schema change

```sql
-- supabase/migrations/20260818000200_user_locale.sql
alter table user_settings
  add column locale text not null default 'th'
  check (locale in ('th','en'));

comment on column user_settings.locale is
  'UI language. Headings stay English in both — see Report/12-i18n-spec.md';
```

That is the only database change this feature needs.

---

## 3. Implementation

No i18n library. The requirements here are narrow — two locales, no URL routing, no plural rules
beyond what `Intl` already gives — and a plain typed dictionary is smaller, faster and easier to
verify than a framework.

### 3.1 Dictionary shape

```
lib/i18n/
├── index.ts        getLocale(), getDictionary(), type Dict
├── th.ts           the source of truth
└── en.ts           typed against th.ts — a missing key is a compile error
```

```ts
// lib/i18n/th.ts
export const th = {
  common: {
    save: "บันทึก",
    cancel: "ยกเลิก",
    delete: "ลบ",
    retry: "ลองใหม่",
  },
  auth: {
    passwordTooShort: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
    badCredentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    resetSent: "ถ้าอีเมลนี้มีบัญชีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว",
    forgotLink: "ลืมรหัสผ่าน?",
  },
  today: {
    restDayBody: "วันนี้ไม่มีเวิร์คเอาท์ตามแผน พักเต็มวันหรือเดินเบา ๆ ได้",
    restDayNote: "วันพักตามแผนไม่นับว่าพลาด และไม่ทำให้ streak ขาด",
    finishWorkout: "จบเวิร์คเอาท์",
    start: "เริ่มเลย",
    weight: "น้ำหนัก",
    reps: "ครั้ง",
    emptySet: "กรอกอย่างน้อยหนึ่งค่าก่อนบันทึก",
  },
  // …
} as const;

export type Dict = typeof th;
```

```ts
// lib/i18n/en.ts
import type { Dict } from "./th";

export const en: Dict = {           // ← the annotation is the safety net
  common: { save: "Save", cancel: "Cancel", delete: "Delete", retry: "Retry" },
  auth: {
    passwordTooShort: "Password must be at least 8 characters",
    badCredentials: "Incorrect email or password",
    resetSent: "If that address has an account, a reset link is on its way",
    forgotLink: "Forgot password?",
  },
  today: {
    restDayBody: "No workout scheduled today. Rest, or take an easy walk.",
    restDayNote: "A planned rest day doesn't count as missed and won't break your streak.",
    finishWorkout: "Finish workout",
    start: "Start",
    weight: "Weight",
    reps: "Reps",
    emptySet: "Fill in at least one value before saving",
  },
} as const;
```

Because `en` is annotated `: Dict`, forgetting a key fails `npm run build`. That is the entire
"missing translation" problem, solved by the type checker rather than by a runtime warning nobody
reads.

**Headings do not go in the dictionary.** `Today`, `Schedule`, `Stats`, `Settings`, `Exercises`,
`Sets`, `Progress` are written directly in the JSX as English literals. Putting them in the
dictionary would invite someone to translate them and quietly break the rule.

### 3.2 Server components

```ts
// lib/i18n/index.ts
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { th } from "./th";
import { en } from "./en";

export type Locale = "th" | "en";

export async function getLocale(): Promise<Locale> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("user_settings").select("locale").eq("user_id", user.id).maybeSingle();
    if (data?.locale === "en" || data?.locale === "th") return data.locale;
  }

  const cookie = (await cookies()).get("locale")?.value;
  if (cookie === "en" || cookie === "th") return cookie;

  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().includes("th") ? "th" : "en";
}

export async function getDictionary(): Promise<typeof th> {
  return (await getLocale()) === "en" ? en : th;
}
```

```tsx
// any server component
const t = await getDictionary();

<h1>Today — {planDay.label}</h1>        {/* heading: English literal + user data */}
<p>{t.today.restDayBody}</p>            {/* body: translated */}
```

### 3.3 Client components

`set-row.tsx`, `exercise-row.tsx` and the buttons are client components and cannot `await`. Resolve
once in `app/(app)/layout.tsx` and provide it.

```tsx
// components/i18n-provider.tsx
"use client";
import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/th";

const Ctx = createContext<Dict | null>(null);

export function I18nProvider({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  return <Ctx.Provider value={dict}>{children}</Ctx.Provider>;
}

export function useT(): Dict {
  const dict = useContext(Ctx);
  if (!dict) throw new Error("useT must be used inside I18nProvider");
  return dict;
}
```

The dictionary is a plain serialisable object, so passing it across the server/client boundary is
free — no functions, no dates, no class instances.

### 3.4 Server actions

Actions return message **keys**, not sentences. An action has no reliable locale context and
should not carry copy.

```ts
// before
if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

// after
if (error) return { errorKey: "auth.badCredentials" as const };
```

The form component resolves the key through `useT()`. This also removes the current duplication
where the same message exists in both `actions.ts` and the component.

**This changes `AuthState`.** Combine it with the widening already required by
`11-end-to-end-plan.md` §3.1:

```ts
export type AuthState = {
  errorKey:  string | null;
  noticeKey: string | null;
};
```

### 3.5 Dates and numbers

Thai dates must use the **Gregorian year**, not the Buddhist era. The app already shows
`14 สิงหาคม 2026` everywhere; switching to 2569 mid-app would be worse than either choice made
consistently.

```ts
export function formatDate(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-gregory" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }).format(d);
}
```

- Numbers: `Intl.NumberFormat` with the same locale. Both use Arabic numerals — do not switch to
  Thai numerals.
- Weekday names already live in `lib/date.ts` as `THAI_DAY_NAMES` / `EN_DAY_NAMES`; select by
  locale instead of importing one directly.
- Units (`kg`, `cm`, `%`) are symbols, not words. Never translated.

---

## 4. Settings

Add to the Settings page (`11-end-to-end-plan.md` §7), in the **Appearance** group next to theme:

```
Language        ( ● ไทย   ○ English )
                Headings stay in English in both languages.
```

Changing it writes `user_settings.locale`, sets the `locale` cookie, and calls
`revalidatePath("/", "layout")` so the whole tree re-renders in the new language without a manual
reload.

---

## 5. What has to change in existing code

| File | Change |
|---|---|
| `supabase/migrations/20260818000200_user_locale.sql` | New — the `locale` column |
| `lib/i18n/{index,th,en}.ts` | New |
| `components/i18n-provider.tsx` | New |
| `app/(app)/layout.tsx` | Resolve the dictionary, wrap children in `I18nProvider` |
| `app/(app)/today/page.tsx` | **Highest-effort file.** Currently all-English literals — split into English headings and dictionary lookups |
| `components/workout/set-row.tsx` | Field labels and the empty-set message via `useT()` |
| `components/workout/exercise-row.tsx` | `เซ็ต × ครั้ง` / `sets × reps` line via `useT()` |
| `components/app-nav.tsx` | Labels become English literals in both locales (`Today`, `History`, …) |
| `app/(auth)/actions.ts` | Return keys, not sentences; `AuthState` becomes `errorKey`/`noticeKey` |
| `app/(auth)/auth-form.tsx` | Resolve keys through `useT()` |
| `app/(app)/history/*` | Status labels and headings split |
| `app/page.tsx` (landing) | Body copy through the dictionary; hero heading stays English |
| `lib/date.ts` | Select day names by locale rather than exporting one set |
| `lib/labels.ts` | Muscle-group labels — translated (they are body copy, not headings) |

**Every page built from now on — Forgot password, Schedule, Stats, Settings — is written this way
from the start.** Retrofitting is what makes this expensive; the pages that do not exist yet cost
nothing extra.

---

## 6. SEO consequence

Only the landing page is indexed (everything else is behind auth and `noindex`), and it now renders
in whichever language the visitor's browser asks for at a single URL. Search engines will index one
of the two.

If Thai search traffic matters later, the fix is `/en` as a second route for the landing page only,
with `hreflang` — not a full locale-routed app. Out of scope now; noted so the choice is deliberate.

`WEBSITE_GDD.md` §10 lists Thai keywords and a Thai meta description. Those stay: the landing page's
default remains Thai unless the browser asks otherwise.

---

## 7. Acceptance

- [ ] `npm run build` fails if a key exists in `th.ts` but not `en.ts`
- [ ] A signed-out visitor with a Thai browser sees Thai body copy; an English browser sees English
- [ ] Signing in applies `user_settings.locale`, overriding the browser
- [ ] Switching language in Settings updates the whole app without a manual reload, and survives
      sign-out (cookie)
- [ ] **Every `h1`, `h2`, nav label, table header and stat-tile label is English in both locales**
- [ ] Exercise names, plan names and variant labels are identical in both locales
- [ ] Thai dates show Gregorian years (2026, not 2569)
- [ ] Validation errors appear in the selected language
- [ ] Password-reset and confirmation emails arrive in the user's language
- [ ] No hardcoded Thai or English sentence remains outside `lib/i18n/`
      (`grep -rnP '[\p{Thai}]' app components --include=*.tsx` should return nothing)
