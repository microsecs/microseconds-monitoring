import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Shadow-only scoring. Never changes live score, incidents, alerts or thresholds. */
export async function recordBehaviorShadow(input: {
 organizationId:string; provider:"microsoft"|"google"; tenantRecordId:string;
 signinId:string; userPrincipalName:string; eventTime:string;
 ip?:string|null; city?:string|null; country?:string|null; application?:string|null;
 liveScore:number; feedbackSafeAdjustment:number; feedbackSuspiciousAdjustment:number;
}) {
 const db=getSupabaseAdmin();
 const user=input.userPrincipalName.trim().toLowerCase();
 if(!user || !input.signinId) return;
 const since=new Date(new Date(input.eventTime).getTime()-90*86400000).toISOString();
 let q=db.from("signins").select("id,ip_address,city,country,app_name,event_time")
  .eq("organization_id",input.organizationId).ilike("user_principal_name",user)
  .ilike("status","success").gte("event_time",since)
  .lt("event_time",input.eventTime).order("event_time",{ascending:false}).limit(500);
 q=input.provider==="google"?q.eq("google_workspace_tenant_id",input.tenantRecordId):q.eq("microsoft_tenant_id",input.tenantRecordId);
 const {data,error}=await q;
 if(error) throw error;
 const history=data||[];
 const reasons:string[]=[];
 let adjustment=0;
 // Observation is never trust. Only verified-safe administrator feedback can reduce risk.
 const matches=(field:"ip_address"|"city"|"country"|"app_name",value?:string|null)=>
  !!value && history.filter(r=>String(r[field]||"").trim().toLowerCase()===value.trim().toLowerCase()).length>=3;
 const familiarIp=matches("ip_address",input.ip);
 const familiarCity=matches("city",input.city);
 const familiarCountry=matches("country",input.country);
 const familiarApp=matches("app_name",input.application);
 if(history.length>=5){
  if(input.ip && !history.some(r=>r.ip_address===input.ip)) {adjustment+=8;reasons.push("Previously unseen IP in established user history (+8)");}
  if(input.country && !history.some(r=>String(r.country||"").toLowerCase()===input.country!.toLowerCase())) {adjustment+=12;reasons.push("Previously unseen country in established user history (+12)");}
  if(input.application && !history.some(r=>String(r.app_name||"").toLowerCase()===input.application!.toLowerCase())) {adjustment+=5;reasons.push("Previously unseen application in established user history (+5)");}
 }
 // Existing administrator feedback is already included in the live score.
 // Never double-apply it in shadow mode; capture it for audit and future comparisons.
 if(input.feedbackSafeAdjustment>0) reasons.push(`Verified-safe feedback already included in live score (-${input.feedbackSafeAdjustment})`);
 if(input.feedbackSuspiciousAdjustment>0) reasons.push(`Confirmed-suspicious feedback already included in live score (+${input.feedbackSuspiciousAdjustment})`);
 if(familiarIp && familiarCountry) reasons.push("Familiar IP and country observed (no automatic trust)");
 const proposed=Math.max(0,Math.min(100,input.liveScore+Math.min(25,adjustment)));
 const {error:saveError}=await db.from("behavior_shadow_assessments").upsert({
  organization_id:input.organizationId,provider:input.provider,tenant_record_id:input.tenantRecordId,
  signin_id:input.signinId,user_principal_name:user,event_time:input.eventTime,
  live_score:input.liveScore,proposed_score:proposed,adjustment:proposed-input.liveScore,
  reasons,history_count:history.length,
  evidence:{familiar_ip:familiarIp,familiar_city:familiarCity,familiar_country:familiarCountry,familiar_application:familiarApp,
   feedback_safe_adjustment:input.feedbackSafeAdjustment,feedback_suspicious_adjustment:input.feedbackSuspiciousAdjustment},
  updated_at:new Date().toISOString()
 },{onConflict:"signin_id"});
 if(saveError) throw saveError;
}
