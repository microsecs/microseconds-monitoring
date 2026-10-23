import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Live behavioral scoring is enabled for every organization after rollout begins.
 * Explicit opt-out and a global kill switch support safe rollback.
 * Never apply the feature retroactively to historical sign-ins.
 */
export function behavioralLiveEnabled(organizationId:string,eventTime:string){
 if(process.env.BEHAVIORAL_LIVE_DISABLED==="true")return false;
 const excluded=(process.env.BEHAVIORAL_LIVE_EXCLUDED_ORG_IDS||"").split(",").map(x=>x.trim()).filter(Boolean);
 if(excluded.includes(organizationId))return false;
 // Conservative deployment boundary; optional environment override for future rollouts.
 const started=Date.parse(process.env.BEHAVIORAL_LIVE_ROLLOUT_STARTED_AT||"2026-10-24T00:00:00Z");
 const event=Date.parse(eventTime);
 return Number.isFinite(started)&&Number.isFinite(event)&&event>=started;
}

export function calculateBehavioralAdjustment(input:{
 history:Array<{ip_address?:string|null;country?:string|null;app_name?:string|null}>;
 ip?:string|null;country?:string|null;application?:string|null;
 feedbackSafeAdjustment:number;feedbackSuspiciousAdjustment:number;
}){
 const norm=(v?:string|null)=>String(v||"").trim().toLowerCase();
 const unseen=(field:"ip_address"|"country"|"app_name",value?:string|null)=>
  !!norm(value)&&!input.history.some(r=>norm(r[field])===norm(value));
 const newIp=unseen("ip_address",input.ip);
 const newCountry=unseen("country",input.country);
 const newApp=unseen("app_name",input.application);
 const mature=input.history.length>=10;
 const verifiedSafe=input.feedbackSafeAdjustment>0;
 const verifiedSuspicious=input.feedbackSuspiciousAdjustment>0;
 const reasons:string[]=[];
 let adjustment=0;
 if(!mature)reasons.push("Insufficient prior observations for behavioral risk adjustment (minimum 10)");
 else if(verifiedSafe&&!verifiedSuspicious)reasons.push("Matching verified-safe feedback: no novelty-based shadow increase");
 else if(newIp&&newCountry){
  adjustment=8;
  reasons.push("Unseen IP and country together in established user history (+8)");
  if(newApp){adjustment+=4;reasons.push("Unseen application alongside IP and country change (+4)");}
 }else if(newIp&&newApp){
  adjustment=4;
  reasons.push("Unseen IP and application together in established user history (+4)");
 }else if(newIp||newCountry||newApp){
  reasons.push("Single unfamiliar attribute observed; no standalone behavioral risk increase");
 }
 return {adjustment:Math.min(12,adjustment),reasons,newIp,newCountry,newApp,mature,verifiedSafe,verifiedSuspicious};
}

export async function assessBehavioralAdjustment(input:{
 organizationId:string;provider:"microsoft"|"google";tenantRecordId:string;
 userPrincipalName:string;eventTime:string;ip?:string|null;country?:string|null;application?:string|null;
 feedbackSafeAdjustment:number;feedbackSuspiciousAdjustment:number;
}){
 const user=input.userPrincipalName.trim().toLowerCase();
 if(!user)return {adjustment:0,reasons:[]};
 const since=new Date(new Date(input.eventTime).getTime()-90*86400000).toISOString();
 const db=getSupabaseAdmin();
 let q=db.from("signins").select("ip_address,country,app_name")
  .eq("organization_id",input.organizationId).ilike("user_principal_name",user)
  .ilike("status","success").gte("event_time",since)
  .lt("event_time",input.eventTime).order("event_time",{ascending:false}).limit(500);
 q=input.provider==="google"?q.eq("google_workspace_tenant_id",input.tenantRecordId):q.eq("microsoft_tenant_id",input.tenantRecordId);
 const {data,error}=await q;
 if(error)throw error;
 return calculateBehavioralAdjustment({history:data||[],ip:input.ip,country:input.country,application:input.application,
  feedbackSafeAdjustment:input.feedbackSafeAdjustment,feedbackSuspiciousAdjustment:input.feedbackSuspiciousAdjustment});
}

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
 const matches=(field:"ip_address"|"city"|"country"|"app_name",value?:string|null)=>
  !!value && history.filter(r=>String(r[field]||"").trim().toLowerCase()===value.trim().toLowerCase()).length>=3;
 const familiarIp=matches("ip_address",input.ip);
 const familiarCity=matches("city",input.city);
 const familiarCountry=matches("country",input.country);
 const familiarApp=matches("app_name",input.application);
 const result=calculateBehavioralAdjustment({history,ip:input.ip,country:input.country,application:input.application,
  feedbackSafeAdjustment:input.feedbackSafeAdjustment,feedbackSuspiciousAdjustment:input.feedbackSuspiciousAdjustment});
 const {adjustment,newIp,newCountry,newApp,mature,verifiedSafe,verifiedSuspicious}=result;
 const reasons=[...result.reasons];
 // Existing administrator feedback is already included in the live score.
 // Never double-apply it in shadow mode; capture it for audit and future comparisons.
 if(input.feedbackSafeAdjustment>0) reasons.push(`Verified-safe feedback already included in live score (-${input.feedbackSafeAdjustment})`);
 if(input.feedbackSuspiciousAdjustment>0) reasons.push(`Confirmed-suspicious feedback already included in live score (+${input.feedbackSuspiciousAdjustment})`);
 if(familiarIp && familiarCountry) reasons.push("Familiar IP and country observed (no automatic trust)");
 const proposed=Math.max(0,Math.min(100,input.liveScore+Math.min(12,adjustment)));
 const {error:saveError}=await db.from("behavior_shadow_assessments").upsert({
  organization_id:input.organizationId,provider:input.provider,tenant_record_id:input.tenantRecordId,
  signin_id:input.signinId,user_principal_name:user,event_time:input.eventTime,
  live_score:input.liveScore,proposed_score:proposed,adjustment:proposed-input.liveScore,
  reasons,history_count:history.length,
  evidence:{familiar_ip:familiarIp,familiar_city:familiarCity,familiar_country:familiarCountry,familiar_application:familiarApp,
   feedback_safe_adjustment:input.feedbackSafeAdjustment,feedback_suspicious_adjustment:input.feedbackSuspiciousAdjustment,
   novel_ip:newIp,novel_country:newCountry,novel_application:newApp,
   mature_history:mature,verified_safe_match:verifiedSafe,verified_suspicious_match:verifiedSuspicious,
   shadow_policy_version:"2c-conservative-20261017"},
  updated_at:new Date().toISOString()
 },{onConflict:"signin_id"});
 if(saveError) throw saveError;
}
