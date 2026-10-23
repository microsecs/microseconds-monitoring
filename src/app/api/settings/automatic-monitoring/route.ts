import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";

export async function GET(){
 try{
  const org=await getOrCreateDevOrganization();
  const {data,error}=await getSupabaseAdmin().from("organization_notification_settings")
   .select("automatic_monitoring_enabled,monitoring_interval_hours").eq("organization_id",org.id).maybeSingle();
  if(error?.code==="42703" || error?.code==="PGRST204"){
    const fallback=await getSupabaseAdmin().from("organization_notification_settings")
      .select("automatic_monitoring_enabled").eq("organization_id",org.id).maybeSingle();
    if(fallback.error)throw fallback.error;
    return NextResponse.json({enabled:fallback.data?.automatic_monitoring_enabled===true,intervalHours:3,migrationRequired:true});
  }
  if(error)throw error;
  return NextResponse.json({enabled:data?.automatic_monitoring_enabled===true,intervalHours:data?.monitoring_interval_hours||3});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not load automatic monitoring setting."},{status:500});}
}

export async function POST(req:NextRequest){
 try{
  const org=await requireWritableOrganization(),body=await req.json();
  const enabled=body?.enabled===true;
  const intervalHours=Number(body?.intervalHours??3);
  if(![1,3,6,12].includes(intervalHours))return NextResponse.json({error:"Choose a monitoring interval of 1, 3, 6, or 12 hours."},{status:400});
  const client=getSupabaseAdmin();
  let {data,error}=await client.from("organization_notification_settings")
   .upsert({organization_id:org.id,automatic_monitoring_enabled:enabled,monitoring_interval_hours:intervalHours,updated_at:new Date().toISOString()},{onConflict:"organization_id"})
   .select("automatic_monitoring_enabled,monitoring_interval_hours").single();
  if(error?.code==="42703" || error?.code==="PGRST204"){
    if(intervalHours!==3)return NextResponse.json({error:"Apply the monitoring frequency database migration before selecting a custom interval."},{status:409});
    const fallback=await client.from("organization_notification_settings")
      .upsert({organization_id:org.id,automatic_monitoring_enabled:enabled,updated_at:new Date().toISOString()},{onConflict:"organization_id"})
      .select("automatic_monitoring_enabled").single();
    data=fallback.data as any;error=fallback.error;
  }
  if(error)throw error;
  return NextResponse.json({ok:true,enabled:data?.automatic_monitoring_enabled===true,intervalHours:(data as any)?.monitoring_interval_hours||3});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not save automatic monitoring setting."},{status:500});}
}
