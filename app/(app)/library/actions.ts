"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function addExercise(_prev: { error:string|null; ok:boolean }, form:FormData) {
  const parsed=z.object({name:z.string().trim().min(1).max(120),muscle:z.enum(["chest","back_lat","shoulders","legs","arms","core","cardio"])}).safeParse({name:form.get("name"),muscle:form.get("muscle")});
  if(!parsed.success)return {error:"กรอกชื่อท่าและกลุ่มกล้ามเนื้อ / Enter a name and muscle group",ok:false};
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:"Please sign in",ok:false};
  const {error}=await db.from("exercises").insert({id:crypto.randomUUID(),name:parsed.data.name,muscle:parsed.data.muscle,kind:parsed.data.muscle==="cardio"?"cardio":"strength",owner_id:user.id,is_public:false,rep_min:parsed.data.muscle==="cardio"?null:8,rep_max:parsed.data.muscle==="cardio"?null:12});
  if(error)return {error:error.message,ok:false};
  revalidatePath("/library");revalidatePath("/schedule");
  return {error:null,ok:true};
}
