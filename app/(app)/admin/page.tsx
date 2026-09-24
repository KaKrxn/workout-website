import { getAdminHealth, type JobStatus, type UserFlag } from "@/lib/queries/admin-health";
import { rebuildRecentStats, reprovisionUser, generateSessionsForUser } from "./actions";
import { ActionButton } from "./health-actions";
import { formatThaiShort, parseISODate } from "@/lib/date";

export const dynamic = "force-dynamic";

const JOB_LABEL: Record<string, string> = {
  "generate-sessions": "สร้างตารางล่วงหน้า (รายสัปดาห์)",
  "refresh-stats": "คำนวณสถิติใหม่ (รายวัน)",
};

/** `2 ชั่วโมงที่แล้ว` — cron cadence is coarse, so hours and days are enough. */
function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

export default async function AdminHealthPage() {
  const health = await getAdminHealth();

  const alerts =
    health.jobs.filter((j) => j.alert).length +
    (health.noUpcomingSessions.length > 0 ? 1 : 0) +
    (health.neverProvisioned.length > 0 ? 1 : 0) +
    (health.drift.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-label">
            สถานะระบบ
          </p>
          <p className="mt-1 text-[19px] font-bold tracking-[-0.02em]">
            {alerts === 0 ? "ปกติทุกอย่าง" : `มี ${alerts} เรื่องที่ต้องดู`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-text-2">
            ผู้ใช้ทั้งหมด <span className="tabular-nums">{health.userCount}</span> บัญชี
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`size-3 rounded-full ${alerts === 0 ? "bg-good" : "bg-s2"}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {health.jobs.map((job) => (
          <JobCard key={job.job} job={job} />
        ))}
      </div>

      <FlagCard
        title="ผู้ใช้ที่ไม่มีตารางล่วงหน้าเหลือแล้ว"
        hint="cron รายสัปดาห์ควรเติมให้อัตโนมัติ ถ้ายังค้างแปลว่ามันไม่ได้ทำงานกับบัญชีนี้"
        users={health.noUpcomingSessions}
        renderAction={(u) => (
          <ActionButton
            label="สร้างตารางให้"
            action={generateSessionsForUser.bind(null, u.id)}
          />
        )}
      />

      <FlagCard
        title="ผู้ใช้ที่ยังไม่ถูกตั้งค่าเริ่มต้น"
        hint="ปกติเกิดตอนสมัคร ถ้าค้างอยู่แปลว่า provisioning ล้มเหลว"
        users={health.neverProvisioned}
        renderAction={(u) => (
          <ActionButton label="ตั้งค่าเริ่มต้น" action={reprovisionUser.bind(null, u.id)} />
        )}
      />

      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-[-0.01em]">
              สถิติสรุปไม่ตรงกับข้อมูลจริง
            </h2>
            <p className="mt-0.5 text-[12.5px] text-text-2">
              เทียบ <code className="text-[11.5px]">daily_stats</code> กับการนับใหม่ 7 วันล่าสุด
            </p>
          </div>
          <ActionButton label="คำนวณใหม่ทั้งหมด" action={rebuildRecentStats} />
        </div>

        {health.drift.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-2">ตรงกันทุกแถว</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {["วันที่", "ผู้ใช้", "ที่เก็บไว้", "นับใหม่"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {health.drift.map((d) => (
                  <tr key={`${d.userId}-${d.date}`}>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">
                      {formatThaiShort(parseISODate(d.date))}
                    </td>
                    <td className="border-b border-border px-2 py-1.5 font-mono text-[11px]">
                      {d.userId.slice(0, 8)}…
                    </td>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">{d.stored}</td>
                    <td className="border-b border-border px-2 py-1.5 tabular-nums">{d.actual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="rounded-[12px] border border-dashed border-axis p-4 text-[12.5px] leading-relaxed text-text-2">
        หน้านี้ตั้งใจไม่ทำสิ่งที่ Supabase Studio ทำได้ดีอยู่แล้ว — การแก้ข้อมูลดิบ เขียน SQL
        หรือเปลี่ยนโครงสร้างตาราง ให้ไปทำที่ Studio ·
        ผู้ดูแลระบบ<b className="text-text-1">อ่านอย่างเดียว</b>สำหรับข้อมูลของผู้ใช้คนอื่น และ
        <b className="text-text-1">เข้าถึงรูปถ่าย น้ำหนัก และรายละเอียดการฝึกรายเซ็ตไม่ได้เลย</b>
      </p>
    </div>
  );
}

function JobCard({ job }: { job: JobStatus }) {
  const detail = job.detail ?? {};
  const entries = Object.entries(detail).filter(([, v]) => !Array.isArray(v) || v.length > 0);

  return (
    <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">
          {JOB_LABEL[job.job] ?? job.job}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            job.alert ? "bg-s2/15 text-s2" : "bg-good/12 text-good-text"
          }`}
        >
          {job.alert ? "ต้องดู" : "ปกติ"}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] text-text-2">
        รันล่าสุด <span className="tabular-nums text-text-1">{ago(job.startedAt)}</span>
      </p>

      {job.alert && <p className="mt-1.5 text-[12.5px] text-text-1">{job.alert}</p>}

      {entries.length > 0 && (
        <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt>{k}</dt>
              <dd className="font-semibold tabular-nums text-text-1">
                {Array.isArray(v) ? v.length : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function FlagCard({
  title,
  hint,
  users,
  renderAction,
}: {
  title: string;
  hint: string;
  users: UserFlag[];
  renderAction: (u: UserFlag) => React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-text-2">{hint}</p>
        </div>
        <span className="text-[19px] font-bold tabular-nums">{users.length}</span>
      </div>

      {users.length > 0 && (
        <ul className="mt-3 space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"
            >
              <span className="text-[13px]">
                {u.displayName}
                <span className="ml-2 font-mono text-[11px] text-label">{u.id.slice(0, 8)}…</span>
              </span>
              {renderAction(u)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
