import { listUsers } from "@/lib/queries/admin-users";
import { requireAdmin } from "@/lib/admin";
import { ActionButton } from "../health-actions";
import { grantAdmin, revokeAdmin } from "../actions";
import { formatThaiShort } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ดูแล · ผู้ดูแลระบบ" };

export default async function AdminRolePage() {
  const actorId = await requireAdmin();
  const users = await listUsers();

  const admins = users.filter((u) => u.isAdmin);
  const others = users.filter((u) => !u.isAdmin);
  const isLastAdmin = admins.length === 1;

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">ผู้ดูแลระบบปัจจุบัน</h2>
          <span className="text-[19px] font-bold tabular-nums">{admins.length}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-text-2">
          ผู้ดูแลอ่านข้อมูลของผู้ใช้ทุกคนได้ แก้คลังท่าได้ และให้สิทธิ์คนอื่นต่อได้
        </p>

        <ul className="mt-3 space-y-2">
          {admins.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold">
                  {u.email ?? u.displayName}
                  {u.id === actorId && (
                    <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-text-2">
                      คุณ
                    </span>
                  )}
                </span>
                <span className="block text-[11.5px] text-label">
                  สมัคร {formatThaiShort(new Date(u.createdAt))}
                </span>
              </span>

              {isLastAdmin ? (
                <span className="text-[11.5px] text-label">
                  ถอนไม่ได้ — เป็นผู้ดูแลคนสุดท้าย
                </span>
              ) : (
                <ActionButton
                  label="ถอนสิทธิ์"
                  action={revokeAdmin.bind(null, u.id)}
                  confirm={
                    u.id === actorId
                      ? "ถอนสิทธิ์ผู้ดูแลของตัวเอง?\n\nคุณจะเข้าหน้านี้ไม่ได้อีก และต้องให้ผู้ดูแลคนอื่นคืนสิทธิ์ให้"
                      : `ถอนสิทธิ์ผู้ดูแลของ ${u.email ?? u.displayName}?`
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">ให้สิทธิ์ผู้ดูแลเพิ่ม</h2>
        <p className="mt-0.5 text-[12.5px] text-text-2">
          เลือกจากบัญชีที่สมัครไว้แล้ว — ไม่มีการเชิญทางอีเมล ต้องสมัครเข้ามาก่อน
        </p>

        {others.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-2">ทุกบัญชีเป็นผู้ดูแลหมดแล้ว</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {others.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px]">{u.email ?? u.displayName}</span>
                  <span className="block text-[11.5px] text-label">
                    สมัคร {formatThaiShort(new Date(u.createdAt))}
                  </span>
                </span>
                <ActionButton
                  label="ให้สิทธิ์ผู้ดูแล"
                  action={grantAdmin.bind(null, u.id)}
                  confirm={`ให้สิทธิ์ผู้ดูแลกับ ${u.email ?? u.displayName}?\n\nจะอ่านข้อมูลของผู้ใช้ทุกคนได้ และให้สิทธิ์คนอื่นต่อได้`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-[12px] border border-dashed border-axis p-4 text-[12.5px] leading-relaxed text-text-2">
        ฐานข้อมูลปฏิเสธการถอนผู้ดูแลคนสุดท้ายเสมอ — กันไม่ให้ล็อกตัวเองออกจากระบบจนต้องไปแก้ที่
        Supabase Studio · ทุกการให้และถอนสิทธิ์ถูกบันทึกในหน้า
        <b className="text-text-1"> บันทึก</b>
      </p>
    </div>
  );
}
