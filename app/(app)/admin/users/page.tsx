import { listUsers } from "@/lib/queries/admin-users";
import { requireAdmin } from "@/lib/admin";
import { ActionButton } from "../health-actions";
import { DeleteUser } from "./delete-user";
import {
  reprovisionUser,
  generateSessionsForUser,
  grantAdmin,
} from "../actions";
import { formatThaiShort, parseISODate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ใช้ · ผู้ดูแลระบบ" };

const dateOnly = (iso: string | null) =>
  iso ? formatThaiShort(new Date(iso)) : "—";

export default async function AdminUsersPage() {
  const actorId = await requireAdmin();
  const users = await listUsers();

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">ผู้ใช้ที่สมัครเข้ามา</h2>
          <span className="text-[19px] font-bold tabular-nums">{users.length}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-text-2">
          เรียงตามวันที่สมัคร · ผู้ดูแล<b className="text-text-1">อ่านได้อย่างเดียว</b>
          สำหรับข้อมูลการฝึก และเข้าถึงรูปถ่ายกับสัดส่วนร่างกายไม่ได้เลย
        </p>
      </section>

      {users.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-[18px] text-[13px] text-text-2 shadow-card">
          ยังไม่มีใครสมัคร
        </p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-card border border-border bg-surface p-[18px] shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                    {u.displayName}
                    {u.isAdmin && (
                      <span className="rounded-md bg-s1/15 px-2 py-0.5 text-[11px] font-bold text-s1">
                        ผู้ดูแล
                      </span>
                    )}
                    {u.id === actorId && (
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-text-2">
                        คุณ
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-text-2">{u.email ?? "—"}</p>
                </div>
                <p className="flex-none text-right text-[11.5px] text-label">
                  สมัคร {dateOnly(u.createdAt)}
                  <br />
                  เข้าล่าสุด {dateOnly(u.lastSignInAt)}
                </p>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3 text-[12px]">
                <Stat label="โปรแกรม" value={u.activePlanName ?? "ยังไม่ตั้งค่า"} />
                <Stat
                  label="ฝึกล่าสุด"
                  value={u.lastSession ? formatThaiShort(parseISODate(u.lastSession)) : "—"}
                />
                <Stat label="เซสชัน 90 วัน" value={String(u.sessions90d)} />
                <Stat label="ตารางล่วงหน้า" value={String(u.upcomingSessions)} />
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ActionButton
                  label="ตั้งค่าเริ่มต้นใหม่"
                  action={reprovisionUser.bind(null, u.id)}
                />
                <ActionButton
                  label="สร้างตารางล่วงหน้า"
                  action={generateSessionsForUser.bind(null, u.id)}
                />
                {!u.isAdmin && (
                  <ActionButton
                    label="ให้สิทธิ์ผู้ดูแล"
                    action={grantAdmin.bind(null, u.id)}
                    confirm={`ให้สิทธิ์ผู้ดูแลกับ ${u.email ?? u.displayName}?\n\nผู้ดูแลอ่านข้อมูลของผู้ใช้ทุกคนได้ และให้สิทธิ์คนอื่นต่อได้`}
                  />
                )}
                {u.id !== actorId && <DeleteUser userId={u.id} email={u.email} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-label">{label}</dt>
      <dd className="font-semibold tabular-nums text-text-1">{value}</dd>
    </div>
  );
}
