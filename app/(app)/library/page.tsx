import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { LibraryView } from "./library-view";
export const metadata={title:"Library · FitTrack"};
export const dynamic="force-dynamic";
export default async function LibraryPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/login");
 const {data,error}=await db.from("exercises").select("id,name,muscle,kind,equipment,rep_min,rep_max,duration_min_s,duration_max_s,per_side,owner_id").order("muscle").order("name");
 if(error)throw new Error("Unable to load exercises");
 return <LibraryView exercises={data??[]} locale={await getLocale()}/>;
}
