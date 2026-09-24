"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTheme } from "next-themes";
import { updateSettings, type SettingsState } from "./actions";

const initialState: SettingsState = { ok: false, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-bold text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export function SettingsForm({
  settings,
}: {
  settings: {
    locale: string;
    theme: string;
    weekly_goal_days: number;
    weekly_cardio_goal: number;
    vtaper_target: number;
  };
}) {
  const { setTheme } = useTheme();
  const [state, formAction] = useActionState<SettingsState, FormData>(
    async (previous, form) => {
      const result = await updateSettings(previous, form);
      if (result.ok) setTheme(String(form.get("theme")));
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="ft-settings-form">
      <div>
        <Field label="Language">
          <select name="locale" defaultValue={settings.locale} className={inputClass}>
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </select>
        </Field>

        <Field label="Theme">
          <select name="theme" defaultValue={settings.theme} className={inputClass}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>

        <Field label="Strength days per week">
          <input
            name="weeklyGoalDays"
            type="number"
            min={1}
            max={7}
            defaultValue={settings.weekly_goal_days}
            className={inputClass}
          />
        </Field>

        <Field label="Cardio sessions per week">
          <input
            name="weeklyCardioGoal"
            type="number"
            min={0}
            max={7}
            defaultValue={settings.weekly_cardio_goal}
            className={inputClass}
          />
        </Field>

        <Field label="V-Taper target">
          <input
            name="vtaperTarget"
            type="number"
            min={1}
            max={3}
            step="0.001"
            defaultValue={settings.vtaper_target}
            className={inputClass}
          />
        </Field>
      </div>

      {(state.error || state.ok) && (
        <p role={state.error ? "alert" : undefined} className="text-[12.5px] text-text-2">
          {state.error ?? "Saved"}
        </p>
      )}
      <div className="p-[18px]">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ft-settings-row">
      <span className="font-extrabold text-[15px]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "ft-input";
