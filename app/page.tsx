import Link from "next/link";
import { Brand } from "@/components/app-header";
import { DesignControls } from "@/components/design-controls";
import { getLocale } from "@/lib/i18n";
export default async function LandingPage(){
 const locale=await getLocale(),en=locale==="en";
 const features=en?[
 ["It remembers for you","Design a 7-day template once. FitTrack generates your schedule weeks ahead — open the app and today’s workout is already waiting."],
 ["It decides with you","Every set shows last time and today’s target, and tells you when to add weight — no digging through history."],
 ["It proves it to your eyes","A heatmap answers ‘am I consistent?’ in one glance — and V-Taper Ratio tracks progress the scale can’t show."]
 ]:[
 ["จำแทนคุณ","ออกแบบเทมเพลต 7 วันครั้งเดียว ระบบสร้างตารางล่วงหน้าให้เป็นเดือน เปิดเว็บมาก็รู้ทันทีว่าวันนี้ต้องทำอะไร"],
 ["ตัดสินใจแทนคุณ","ทุกแถวบอกครั้งก่อนและเป้าวันนี้ พร้อมบอกว่าเมื่อไรควรเพิ่มน้ำหนัก โดยไม่ต้องเปิดประวัติเก่าอ่านเอง"],
 ["พิสูจน์ให้เห็นด้วยตา","Heatmap ตอบคำถามว่าเราสม่ำเสมอไหมได้ในสายตาเดียว และวัดผลด้วย V-Taper Ratio ไม่ใช่น้ำหนักบนตาชั่ง"]];
 const cta=en?"Start free":"เริ่มใช้งานฟรี";
 return <><header className="ft-public-header pb-5 border-b border-border"><Brand href="/"/><div className="flex items-center gap-3 flex-wrap"><DesignControls locale={locale}/><Link href="/login" className="ft-button ft-secondary">{en?"Log in":"เข้าสู่ระบบ"}</Link><Link href="/signup" className="ft-button">{cta}</Link></div></header>
 <main className="ft-landing"><section className="ft-landing-hero"><p className="ft-kicker tracking-[.14em]">HOME WORKOUT & BODY-COMPOSITION TRACKER</p><h1>{en?"A schedule you design once — it keeps running for you every month":"ตารางที่คุณออกแบบเอง วิ่งต่อให้เองทุกเดือน"}</h1><p className="text-[clamp(17px,2.4vw,22px)] mb-7">{en?"And proves you were actually consistent.":"และพิสูจน์ให้เห็นว่าคุณสม่ำเสมอจริง"}</p><div className="flex flex-wrap gap-3"><Link href="/signup" className="ft-button">{cta} →</Link><Link href="/today" className="ft-button ft-secondary">{en?"Open my workouts":"เปิดตารางของฉัน"}</Link></div></section>
 <section className="ft-landing-stats">{[["4",en?"Exercise logging types":"ชนิดการบันทึกท่าออกกำลังกาย"],["7 → ∞",en?"A weekly template that keeps going":"เทมเพลต 7 วัน สร้างล่วงหน้าเป็นเดือน"],["A ⇄ B",en?"Switch plans to fit your day":"สลับแผนให้เหมาะกับวันของคุณ"]].map(([v,l])=><div key={v}><strong>{v}</strong><span className="ft-muted">{l}</span></div>)}</section>
 <section className="pb-12">{features.map(([title,body],i)=><article className="ft-feature" key={title}><span className="ft-kicker">0{i+1}</span><div><h2>{title}</h2><p>{body}</p></div></article>)}</section>
 <section className="pb-14"><h2 className="text-3xl font-bold mb-6">{en?"What a notebook can’t do":"สิ่งที่สมุดจดทำไม่ได้"}</h2><div className="grid sm:grid-cols-2 border-t border-l border-border">{(en?[["Template → auto-generation","Design once, it keeps running every month."],["Plan vs. actual","Measure adherence, not just rep counts."],["Multiple plans per day","Switch to bodyweight without editing your schedule."],["Room to rest","Planned rest days never count as a miss."]]:[["เทมเพลต → สร้างตารางอัตโนมัติ","ออกแบบครั้งเดียว วิ่งต่อให้เองทุกเดือน"],["แยกแผนกับสิ่งที่ทำจริง","วัดความสม่ำเสมอ มากกว่าการนับครั้ง"],["หลายแผนต่อวัน","สลับท่าไม่ใช้อุปกรณ์ได้โดยไม่ต้องแก้ตาราง"],["มีพื้นที่ให้พัก","วันพักตามแผนไม่นับว่าขาด"]]).map(([t,b])=><div key={t} className="p-5 border-b border-r border-border"><h3 className="font-extrabold mb-2">{t}</h3><p className="ft-muted">{b}</p></div>)}</div></section></main>
 <section className="bg-s1 text-on-accent px-6 py-[72px]"><div className="max-w-[1120px] mx-auto"><h2 className="text-[clamp(32px,5vw,56px)] font-bold leading-tight max-w-[20ch] mb-6">{en?"A schedule you design, that proves you showed up.":"ตารางที่คุณออกแบบเอง และพิสูจน์ว่าคุณมาจริง"}</h2><Link href="/signup" className="ft-button bg-page text-good-text">{cta} →</Link></div></section><footer className="ft-landing py-6 text-xs ft-muted">FitTrack · Home Workout & Body-Composition Tracker</footer></>;
}
