import {getSupabaseAdmin} from "@/lib/supabaseAdmin";

type Provider="microsoft"|"google";
export type FeedbackContext={summary:string[];safeAdjustment:number;suspiciousAdjustment:number};

const norm=(v:any)=>String(v??"").trim().toLowerCase();
const DAY=24*60*60*1000;

/**
 * Conservative, tenant- and user-scoped feedback learning.
 * Only verified Safe / Confirm Suspicious actions are stored as feedback.
 * Dismissal is intentionally not evidence. A single safe event earns only a
 * small adjustment; repeated independent confirmations increase confidence.
 * Conflicting recent evidence prevents safe feedback from reducing risk.
 */
export async function getRelevantIncidentFeedback(x:{organizationId:string;provider:Provider;tenantRecordId:string;userPrincipalName:string;ip?:string|null;city?:string|null;country?:string|null;networkProvider?:string|null;asn?:string|null}):Promise<FeedbackContext>{
 const user=norm(x.userPrincipalName);
 if(!user||!x.organizationId||!x.tenantRecordId)return {summary:[],safeAdjustment:0,suspiciousAdjustment:0};
 const db=getSupabaseAdmin();
 let q=db.from("incident_feedback").select("incident_id,feedback_type,ip_address,city,country,network_provider,asn,created_at")
  .eq("organization_id",x.organizationId).ilike("user_principal_name",user)
  .gte("created_at",new Date(Date.now()-90*DAY).toISOString())
  .order("created_at",{ascending:false}).limit(100);
 q=x.provider==="google"?q.eq("google_workspace_tenant_id",x.tenantRecordId):q.eq("microsoft_tenant_id",x.tenantRecordId);
 const {data,error}=await q;
 if(error){console.warn("[feedback] lookup failed",error);return {summary:[],safeAdjustment:0,suspiciousAdjustment:0};}
 const seen=new Set<string>();
 let safeExact=0,safeSimilar=0,suspiciousExact=0,suspiciousSimilar=0;
 for(const f of data||[]){
  const incidentId=String(f.incident_id||"");
  if(incidentId&&seen.has(incidentId))continue;
  if(incidentId)seen.add(incidentId);
  const exactIp=!!x.ip&&norm(f.ip_address)===norm(x.ip);
  const sameNetwork=(!!x.networkProvider&&norm(f.network_provider)===norm(x.networkProvider))||
   (!!x.asn&&norm(f.asn)===norm(x.asn));
  const sameLocation=(!!x.city&&!!x.country&&norm(f.city)===norm(x.city)&&norm(f.country)===norm(x.country));
  // Require exact IP or BOTH matching network and city/country. Country alone is too broad.
  if(!exactIp&&!(sameNetwork&&sameLocation))continue;
  if(f.feedback_type==="safe"){
   if(exactIp)safeExact++;else safeSimilar++;
  }else if(f.feedback_type==="suspicious"){
   if(exactIp)suspiciousExact++;else suspiciousSimilar++;
  }
 }
 const safeCount=safeExact+safeSimilar;
 const suspiciousCount=suspiciousExact+suspiciousSimilar;
 const summary:string[]=[];
 let safeAdjustment=0,suspiciousAdjustment=0;
 // Never treat verified-safe history as a blanket allowlist; contradictory
 // suspicious feedback blocks a safe reduction and is surfaced to the AI.
 if(safeCount&&suspiciousCount){
  summary.push(`Conflicting administrator feedback: ${safeCount} safe and ${suspiciousCount} suspicious similar sign-ins; no trust reduction applied.`);
 }
 if(safeCount&&!suspiciousCount){
  safeAdjustment=Math.min(12,(safeExact?4:2)+Math.min(4,safeExact)*2+Math.min(2,safeSimilar));
  summary.push(`${safeCount} administrator-verified safe similar sign-in(s) within 90 days (${safeAdjustment}-point bounded trust signal).`);
 }
 if(suspiciousCount){
  suspiciousAdjustment=Math.min(25,(suspiciousExact?12:7)+Math.min(4,suspiciousExact)*3+Math.min(3,suspiciousSimilar)*2);
  summary.push(`${suspiciousCount} administrator-confirmed suspicious similar sign-in(s) within 90 days (${suspiciousAdjustment}-point risk signal).`);
 }
 return {summary,safeAdjustment,suspiciousAdjustment};
}

export async function recordIncidentFeedback(x:{organizationId:string;incident:any;signin:any;intel:any;feedbackType:"safe"|"suspicious"}){
 const provider=x.incident.google_workspace_tenant_id?"google":"microsoft";
 const user=String(x.signin?.user_principal_name||"").trim();if(!user)return;
 const row:any={organization_id:x.organizationId,incident_id:x.incident.id,provider,user_principal_name:user,feedback_type:x.feedbackType,
  microsoft_tenant_id:x.incident.microsoft_tenant_id||null,google_workspace_tenant_id:x.incident.google_workspace_tenant_id||null,
  ip_address:x.signin?.ip_address||null,city:x.signin?.city||x.intel?.city||null,region:x.signin?.region||x.intel?.region||null,country:x.signin?.country||x.intel?.country||null,
  network_provider:x.intel?.provider||null,asn:x.intel?.asn||null,is_vpn:x.intel?.is_vpn??null,is_proxy:x.intel?.is_proxy??null,is_tor:x.intel?.is_tor??null,is_hosting:x.intel?.is_hosting??null};
 const {error}=await getSupabaseAdmin().from("incident_feedback").insert(row);if(error)throw error;
}
