import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";

export async function GET(){
 try{
  const org=await getOrCreateDevOrganization();
  const {data,error}=await getSupabaseAdmin().from("organization_notification_settings")
   .select("automatic_monitoring_enabled").eq("organization_id",org.id).maybeSingle();
  if(error)throw error;
  return NextResponse.json({enabled:data?.automatic_monitoring_enabled===true});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not load automatic monitoring setting."},{status:500});}
}

export async function POST(req:NextRequest){
 try{
  const org=await getOrCreateDevOrganization(),body=await req.json();
  const enabled=body?.enabled===true;
  const {data,error}=await getSupabaseAdmin().from("organization_notification_settings")
   .upsert({organization_id:org.id,automatic_monitoring_enabled:enabled,updated_at:new Date().toISOString()},{onConflict:"organization_id"})
   .select("automatic_monitoring_enabled").single();
  if(error)throw error;
  return NextResponse.json({ok:true,enabled:data.automatic_monitoring_enabled===true});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not save automatic monitoring setting."},{status:500});}
}
