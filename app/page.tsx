import Link from "next/link";

const FEATURES = [
  {
    title: "สลับโปรแกรม A ⇄ B รายวัน",
    body: "วันไหนไม่สะดวกใช้ดัมเบล สลับเป็นโปรแกรมไม่ใช้อุปกรณ์ได้ในแตะเดียว โดย streak ไม่ขาด เพราะระบบนับว่าฝึกกลุ่มกล้ามเนื้อนี้แล้ว ไม่ได้นับว่าทำท่านี้แล้ว",
  },
  {
    title: "บอกเป้าของวันนี้ให้เลย",
    body: "ไม่ต้องเปิดประวัติเองว่าครั้งก่อนทำได้เท่าไหร่ ระบบคำนวณจาก double progression แล้วบอกว่ารอบนี้ควรทำกี่ครั้ง และพร้อมเพิ่มน้ำหนักหรือยัง",
  },
  {
    title: "วัดที่รูปร่าง ไม่ใช่ตาชั่ง",
    body: "V-Taper Ratio (ไหล่ ÷ เอว) เป็นตัวเลขหลัก เพราะระหว่างสร้างกล้ามพร้อมลดไขมัน น้ำหนักมักไม่ขยับแม้รูปร่างจะเปลี่ยนไปแล้ว",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-24">
      <header className="flex items-center gap-3 py-5">
        <span className="grid size-[26px] place-items-center rounded-[8px] bg-s1">
          <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden="true">
            <path
              d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="text-base font-bold tracking-[-0.02em]">FitTrack</span>
      </header>

      <section className="pt-10 pb-14 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-label">
          ออกกำลังกายที่บ้าน · ดัมเบล 25 kg · เบาะราบ · ลู่วิ่ง
        </p>
        <h1 className="mt-3 max-w-[18ch] text-4xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-5xl">
          ติดตามการฝึก ที่วัดผลเป็นรูปร่าง
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-text-2">
          เว็บติดตามการออกกำลังกายสำหรับคนที่ฝึกเองที่บ้าน เป้าหมายคือลดไขมันและสร้างทรง
          V-Taper จึงออกแบบให้เว็บทำหน้าที่แทนเทรนเนอร์ ไม่ใช่แค่สมุดจด
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-semibold text-on-accent transition hover:brightness-110"
          >
            เริ่มใช้งาน
          </Link>
          <Link
            href="/login"
            className="rounded-[10px] border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold transition hover:bg-surface-2"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="rounded-card border border-border bg-surface p-[18px] shadow-card"
          >
            <h2 className="text-[15px] font-bold tracking-[-0.01em]">{f.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-2">{f.body}</p>
          </article>
        ))}
      </section>

      <p className="mt-7 rounded-[12px] border border-dashed border-axis p-4 text-[12.5px] leading-relaxed text-text-2">
        ไม่สามารถสั่งให้ร่างกายเผาผลาญไขมันเฉพาะจุดได้ ความชัดของแนวกรามมาจาก
        <b className="text-text-1"> เปอร์เซ็นต์ไขมันรวมที่ลดลง </b>
        ประกอบกับโครงสร้างกระดูก ปริมาณกล้ามเนื้อ และท่าทางของศีรษะ/คอ
      </p>
    </main>
  );
}
