import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {getOrganizationNotificationSettings} from "@/lib/notificationSettings";
function validTimeZone(value:unknown):value is string {
 if(typeof value!=="string"||value.length>100)return false;
 try{new Intl.DateTimeFormat("en-US",{timeZone:value});return true;}catch{return false;}
}
function parseEmails(value:unknown){return Array.from(new Set(String(value||"").split(/[\n,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean)));}
export async function GET(){
 try{const org=await getOrCreateDevOrganization();return NextResponse.json({organization:{id:org.id,name:org.name},settings:await getOrganizationNotificationSettings(org.id)});}
 catch(e:any){return NextResponse.json({error:e?.message||"Could not load notification settings."},{status:500});}
}
export async function POST(req:NextRequest){
 try{
  const b=await req.json(),org=await requireWritableOrganization();
  const emails=parseEmails(b?.alertEmails);
  const timeZone=b?.notificationTimeZone??"America/Los_Angeles";
  if(!validTimeZone(timeZone))return NextResponse.json({error:"Invalid notification timezone"},{status:400});
  const row={organization_id:org.id,enabled:b?.enabled!==false,alert_emails:emails,notification_time_zone:timeZone,
   alert_successful_suspicious:b?.alertSuccessfulSuspicious!==false,alert_failed_suspicious:false,
   min_risk_score:Math.max(0,Math.min(100,Number(b?.minRiskScore??50))),
   immediate_critical:b?.immediateCritical!==false,hourly_digest_review:b?.hourlyDigestReview!==false,
   updated_at:new Date().toISOString()};
  const {data,error}=await getSupabaseAdmin().from("organization_notification_settings").upsert(row,{onConflict:"organization_id"}).select("*").single();
  if(error)throw error;return NextResponse.json({ok:true,settings:data});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not save notification settings."},{status:500});}
}