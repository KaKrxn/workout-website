"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Day = { id:string; day_of_week:number|null; label:string; is_rest:boolean; is_default:boolean; variant_label:string };
type Item = { id:string; plan_day_id:string; target_sets:number; exercises:{name:string}|null };
export function ScheduleCalendar({ days, items, today, children, locale }: { days:Day[]; items:Item[]; today:string; children:ReactNode; locale:"th"|"en" }) {
  const initial = new Date(today+"T12:00:00");
  const [month,setMonth]=useState(new Date(initial.getFullYear(),initial.getMonth(),1));
  const [selected,setSelected]=useState<Date|null>(null);
  const [plan,setPlan]=useState(false);
  const en=locale === "en";
  const fmt=new Intl.DateTimeFormat(en?"en-US":"th-TH",{month:"long",year:"numeric"});
  const start=new Date(month); start.setDate(1-((month.getDay()+6)%7));
  const length=Math.ceil((((month.getDay()+6)%7)+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7;
  const dates=Array.from({length},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const getDay=(d:Date)=>days.find(x=>x.day_of_week===d.getDay()&&x.is_default) ?? days.find(x=>x.day_of_week===d.getDay());
  const selectedDay=selected?getDay(selected):undefined;
  const selectedItems=items.filter(i=>i.plan_day_id===selectedDay?.id);
  const shift=(n:number)=>{setMonth(new Date(month.getFullYear(),month.getMonth()+n,1));setSelected(null);};
  return <div className="ft-calendar">
    <header className="ft-page-head"><div><button className="mb-3 text-lg" onClick={()=>{setSelected(null);setPlan(false);}}>{selected?"‹ ":""}Calendar</button><div className="flex flex-wrap items-center gap-4"><h1>{plan?"7 Day Plan":fmt.format(month)}</h1>{!plan&&<><button className="ft-calendar-arrow" aria-label="Previous month" onClick={()=>shift(-1)}><ChevronLeft/></button><button className="ft-calendar-arrow" aria-label="Next month" onClick={()=>shift(1)}><ChevronRight/></button></>}</div></div><div className="ft-segments"><button aria-pressed={!plan} onClick={()=>setPlan(false)}>Schedule</button><button aria-pressed={plan} onClick={()=>setPlan(true)}>7 Day Plan</button></div></header>
    {plan?children:<>
      <div className="ft-calendar-head">{(en?["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]:["จ","อ","พ","พฤ","ศ","ส","อา"]).map(d=><span key={d}>{d}</span>)}</div>
      <div className="ft-calendar-well"><div className="ft-calendar-grid">{dates.map(d=>{
        const day=getDay(d), iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        return <button key={iso} className="ft-calendar-cell" data-outside={d.getMonth()!==month.getMonth()} data-today={iso===today} aria-pressed={selected?.getTime()===d.getTime()} onClick={()=>setSelected(d)}><strong>{d.getDate()}</strong><span>{day?.is_rest?(en?"Rest":"พัก"):day?.label??"—"}</span></button>;
      })}</div></div>
      {selected&&<div className="ft-two-col mt-6"><section className="ft-card"><p className="ft-muted">{selected.toLocaleDateString(en?"en-US":"th-TH",{dateStyle:"full"})}</p><h2 className="my-3 text-3xl font-extrabold">{selectedDay?.label??(en?"No plan":"ยังไม่มีแผน")}</h2><p className="ft-muted mb-5">{selectedItems.length} {en?"exercises":"ท่า"} · {selectedItems.reduce((n,i)=>n+i.target_sets,0)} {en?"sets":"เซ็ต"}</p>{selectedDay&&<Link href={`/schedule/${selectedDay.id}`} className="ft-button">{en?"Edit day plan":"แก้ไขแผนวันนี้"}</Link>}</section><section className="ft-card space-y-4">{selectedItems.length?selectedItems.map(i=><div key={i.id} className="flex items-center justify-between gap-4 rounded-[15px] bg-surface-2 p-4"><strong>{i.exercises?.name??"Exercise"}</strong><span>{i.target_sets} sets</span></div>):<p className="ft-muted">{en?"Rest and recover. A planned rest day keeps your streak intact.":"พักและฟื้นฟูร่างกาย วันพักตามแผนไม่ทำให้สตรีคขาด"}</p>}</section></div>}
    </>}
  </div>;
}
