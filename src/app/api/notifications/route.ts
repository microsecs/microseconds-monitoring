import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {getOrganizationNotificationSettings} from "@/lib/notificationSettings";
function parseEmails(value:unknown){return Array.from(new Set(String(value||"").split(/[\n,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean)));}
export async function GET(){
 try{const org=await getOrCreateDevOrganization();return NextResponse.json({organization:{id:org.id,name:org.name},settings:await getOrganizationNotificationSettings(org.id)});}
 catch(e:any){return NextResponse.json({error:e?.message||"Could not load notification settings."},{status:500});}
}
export async function POST(req:NextRequest){
 try{
  const b=await req.json(),org=await requireWritableOrganization();
  const row={organization_id:org.id,enabled:b?.enabled!==false,alert_emails:parseEmails(b?.alertEmails),
   alert_successful_suspicious:b?.alertSuccessfulSuspicious!==false,alert_failed_suspicious:false,
   min_risk_score:Math.max(0,Math.min(100,Number(b?.minRiskScore??50))),
   immediate_critical:b?.immediateCritical!==false,hourly_digest_review:b?.hourlyDigestReview!==false,
   updated_at:new Date().toISOString()};
  const {data,error}=await getSupabaseAdmin().from("organization_notification_settings").upsert(row,{onConflict:"organization_id"}).select("*").single();
  if(error)throw error;return NextResponse.json({ok:true,settings:data});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not save notification settings."},{status:500});}
}