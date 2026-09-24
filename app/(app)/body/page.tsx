import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/date";
import { DataChart } from "@/components/data-chart";
import { Measurements } from "./measurements";
export const metadata={title:"Body · FitTrack"};
export const dynamic="force-dynamic";
export default async function BodyPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/login");
 const [{data:metrics,error},{data:settings}]=await Promise.all([db.from("body_metrics").select("date,metric_id,value").eq("user_id",user.id).order("date",{ascending:false}).limit(1000),db.from("user_settings").select("vtaper_target").eq("user_id",user.id).maybeSingle()]);
 if(error)throw new Error("Unable to load measurements");
 const locale=await getLocale(),en=locale==="en";
 const latest=(id:string)=>metrics?.find(m=>m.metric_id===id)?.value;
 const shoulder=latest("measure_shoulder"),waist=latest("measure_waist");
 const grouped=new Map<string,Record<string,number>>();for(const m of metrics??[]){const row=grouped.get(m.date)??{};row[m.metric_id]=m.value;grouped.set(m.date,row);}
 const rows=[...grouped].map(([date,m])=>({date,...m,ratio:m.measure_shoulder&&m.measure_waist?m.measure_shoulder/m.measure_waist:null}));
 return <div className="ft-page"><header className="ft-page-head"><div><h1>Body</h1><p className="ft-muted mt-1">{en?"Measure progress by proportion, not the number on the scale.":"วัดความก้าวหน้าด้วยสัดส่วน ไม่ใช่ตัวเลขบนตาชั่ง"}</p></div></header>
 <div className="ft-tiles">{[["V-Taper Ratio",shoulder&&waist?(shoulder/waist).toFixed(3):"—"],[en?"Body fat":"ไขมัน",latest("body_fat_pct")!=null?latest("body_fat_pct")+"%":"—"],[en?"Weight":"น้ำหนัก",latest("weight")!=null?latest("weight")+" kg":"—"],[en?"Waist":"รอบเอว",waist!=null?waist+" cm":"—"]].map(([label,value])=><div key={label}><span className="ft-muted text-xs">{label}</span><strong>{value}</strong></div>)}</div>
 <div className="ft-two-col mb-6"><Measurements today={todayISO()} locale={locale}/><DataChart title="V-Taper Ratio" kicker={en?"PROGRESS":"ความก้าวหน้า"} target={settings?.vtaper_target??1.618} rows={rows.filter(r=>r.ratio!=null).map(r=>({label:r.date,value:r.ratio!})).reverse()}/></div>
 <section className="ft-card"><p className="ft-kicker">{en?"MEASUREMENT HISTORY":"ประวัติการวัด"}</p><div className="ft-table-wrap"><table className="ft-table"><thead><tr>{["Date","Shoulder","Waist","V-Taper","Weight","BF%"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{[...grouped].map(([date,m])=><tr key={date}><td>{date}</td><td>{m.measure_shoulder??"—"}</td><td>{m.measure_waist??"—"}</td><td className="text-good-text font-bold">{m.measure_shoulder&&m.measure_waist?(m.measure_shoulder/m.measure_waist).toFixed(3):"—"}</td><td>{m.weight??"—"}</td><td>{m.body_fat_pct??"—"}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="ft-muted py-6">{en?"Add your first measurement above.":"เริ่มบันทึกสัดส่วนครั้งแรกด้านบน"}</p>}</section></div>;
}
