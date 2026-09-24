"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const metricIds = [
  "weight",
  "body_fat_pct",
  "measure_shoulder",
  "measure_chest",
  "measure_waist",
  "measure_arm",
  "measure_neck",
] as const;

const metricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metricId: z.enum(metricIds),
  value: z.coerce.number().positive().max(1000),
});

export type BodyActionState = { ok: boolean; error: string | null };

export async function logMeasurements(_prev: BodyActionState, form: FormData): Promise<BodyActionState> {
  const date=form.get("date");
  const values=["measure_shoulder","measure_waist","weight","body_fat_pct"].filter(id=>form.get(id)!=="" && form.get(id)!=null).map(id=>metricSchema.safeParse({date,metricId:id,value:form.get(id)}));
  if(!values.length || values.some(v=>!v.success)) return {ok:false,error:"ตรวจสอบข้อมูลก่อนบันทึก / Check your measurements"};
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return {ok:false,error:"Please sign in"};
  const rows=values.flatMap(v=>v.success?[{user_id:user.id,date:v.data.date,metric_id:v.data.metricId,value:v.data.value}]:[]);
  const {error}=await db.from("body_metrics").upsert(rows,{onConflict:"user_id,date,metric_id"});
  if(error)return {ok:false,error:error.message};
  revalidatePath("/body");revalidatePath("/analytics");return {ok:true,error:null};
}

export async function logBodyMetric(
  _prev: BodyActionState,
  formData: FormData,
): Promise<BodyActionState> {
  const parsed = metricSchema.safeParse({
    date: formData.get("date"),
    metricId: formData.get("metricId"),
    value: formData.get("value"),
  });

  if (!parsed.success) return { ok: false, error: "กรอกข้อมูลให้ครบก่อนบันทึก" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ต้องเข้าสู่ระบบก่อน" };

  const { error } = await supabase.from("body_metrics").upsert(
    {
      user_id: user.id,
      date: parsed.data.date,
      metric_id: parsed.data.metricId,
      value: parsed.data.value,
    },
    { onConflict: "user_id,date,metric_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/body");
  revalidatePath("/analytics");
  return { ok: true, error: null };
}
