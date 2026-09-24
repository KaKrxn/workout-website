import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { getLocale } from "@/lib/i18n";
import { HistoryView } from "./history-view";
export const metadata={title:"History · FitTrack"};export const dynamic="force-dynamic";
export default async function HistoryPage(){
 const db=await createClient();const {data:sessions,error}=await db.from("sessions").select("id,date,status,focus,plan_days(label)").lte("date",todayISO()).neq("status","planned").order("date",{ascending:false}).limit(60);
 if(error)throw new Error("Unable to load history");
 const ids=(sessions??[]).map(s=>s.id);
 const {data:sets,error:setsError}=ids.length?await db.from("session_sets").select("id,session_id,reps,weight_kg,duration_s,distance_m,exercises(name)").in("session_id",ids).order("set_index"):{data:[],error:null};
 if(setsError)throw new Error("Unable to load recorded sets");
 return <HistoryView sessions={sessions??[]} sets={sets??[]} locale={await getLocale()}/>;
}
