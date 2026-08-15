import { listAuditLog, listJobRuns } from "@/lib/queries/admin-users";

export const dynamic = "force-dynamic";
export const metadata = { title: "บันทึก · ผู้ดูแลระบบ" };

const ACTION_LABEL: Record<string, string> = {
  "admin.grant": "ให้สิทธิ์ผู้ดูแล",
  "admin.revoke": "ถอนสิทธิ์ผู้ดูแล",
  "user.delete": "ลบบัญชี",
  "user.reprovision": "ตั้งค่าเริ่มต้นใหม่",
  "user.generate_sessions": "สร้างตารางล่วงหน้า",
  "stats.rebuild": "คำนวณสถิติใหม่",
};

const JOB_LABEL: Record<string, string> = {
  "generate-sessions": "สร้างตารางล่วงหน้า",
  "refresh-stats": "คำนวณสถิติใหม่",
};

/** `16 ส.ค. 14:32` — logs need the time, unlike everywhere else in the app. */
function stamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

const compact = (o: Record<string, unknown>) => {
  const entries = Object.entries(o).filter(
    ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
  return entries.length === 0 ? null : entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" · ");
};

export default async function AdminLogsPage() {
  const [audit, jobs] = await Promise.all([listAuditLog(200), listJobRuns(50)]);

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">การกระทำของผู้ดูแล</h2>
          <span className="text-[12.5px] text-label">
            ล่าสุด <span className="tabular-nums">{audit.length}</span> รายการ
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-text-2">
          เขียนได้อย่างเดียว — แก้และลบไม่ได้จากในเว็บ แม้แต่ผู้ดูแลเอง
        </p>

        {audit.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-2">ยังไม่มีการกระทำที่บันทึกไว้</p>
        ) : (
          <ul className="mt-3">
            {audit.map((e) => {
              const extra = compact(e.detail);
              return (
                <li key={e.id} className="border-t border-border py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </span>
                    <span className="text-[11.5px] tabular-nums text-label">
                      {stamp(e.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-2">
                    โดย {e.actorEmail ?? "(บัญชีถูกลบแล้ว)"}
                    {e.target && (
                      <>
                        {" · "}
                        <span className="font-mono text-[11px]">{e.target.slice(0, 8)}…</span>
                      </>
                    )}
                  </p>
                  {extra && (
                    <p className="mt-0.5 font-mono text-[11px] text-label">{extra}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">ประวัติงานตามเวลา (cron)</h2>
          <span className="text-[12.5px] text-label">
            ล่าสุด <span className="tabular-nums">{jobs.length}</span> ครั้ง
          </span>
        </div>

        {jobs.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-2">
            ยังไม่มีการรัน — cron ทำงานเฉพาะบน production deployment เท่านั้น
          </p>
        ) : (
          <ul className="mt-3">
            {jobs.map((j) => {
              const extra = compact(j.detail);
              const seconds =
                j.finishedAt && j.startedAt
                  ? (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) / 1000
                  : null;

              return (
                <li key={j.id} className="border-t border-border py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      {JOB_LABEL[j.job] ?? j.job}
                      <span
                        className={`rounded-md px-1.5 py-px text-[10.5px] font-bold ${
                          j.ok === true
                            ? "bg-good/12 text-good-text"
                            : j.ok === false
                              ? "bg-s2/15 text-s2"
                              : "bg-surface-2 text-text-2"
                        }`}
                      >
                        {j.ok === true ? "สำเร็จ" : j.ok === false ? "ล้มเหลว" : "ไม่จบ"}
                      </span>
                    </span>
                    <span className="text-[11.5px] tabular-nums text-label">
                      {stamp(j.startedAt)}
                      {seconds !== null && ` · ${seconds.toFixed(1)} วิ`}
                    </span>
                  </div>
                  {extra && <p className="mt-0.5 font-mono text-[11px] text-label">{extra}</p>}
                  {j.error && <p className="mt-0.5 text-[12px] text-text-1">{j.error}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
