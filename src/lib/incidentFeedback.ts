import {getSupabaseAdmin} from "@/lib/supabaseAdmin";

type Provider="microsoft"|"google";
export type FeedbackContext={summary:string[];safeAdjustment:number;suspiciousAdjustment:number};

const norm=(v:any)=>String(v||"").trim().toLowerCase();

export async function getRelevantIncidentFeedback(x:{organizationId:string;provider:Provider;tenantRecordId:string;userPrincipalName:string;ip?:string|null;city?:string|null;country?:string|null;networkProvider?:string|null;asn?:string|null}):Promise<FeedbackContext>{
 const db=getSupabaseAdmin();
 let q=db.from("incident_feedback").select("feedback_type,ip_address,city,country,network_provider,asn,created_at")
  .eq("organization_id",x.organizationId).ilike("user_principal_name",x.userPrincipalName).order("created_at",{ascending:false}).limit(25);
 q=x.provider==="google"?q.eq("google_workspace_tenant_id",x.tenantRecordId):q.eq("microsoft_tenant_id",x.tenantRecordId);
 const {data,error}=await q;if(error){console.warn("[feedback] lookup failed",error);return {summary:[],safeAdjustment:0,suspiciousAdjustment:0};}
 let safe=0,suspicious=0;const summary:string[]=[];
 for(const f of data||[]){
  const exactIp=!!x.ip&&norm(f.ip_address)===norm(x.ip);
  const sameProvider=!!x.networkProvider&&norm(f.network_provider)===norm(x.networkProvider);
  const sameAsn=!!x.asn&&norm(f.asn)===norm(x.asn);
  const sameCity=!!x.city&&norm(f.city)===norm(x.city);
  const sameCountry=!!x.country&&norm(f.country)===norm(x.country);
  const similar=exactIp||((sameProvider||sameAsn)&&(sameCity||sameCountry));
  if(!similar)continue;
  // Rows are newest first. The most recent matching administrator decision wins.
  if(f.feedback_type==="safe")safe=exactIp?20:12;
  if(f.feedback_type==="suspicious")suspicious=exactIp?20:12;
  break;
 }
 if(safe)summary.push(`Administrator previously marked similar activity safe (${safe}-point trust signal).`);
 if(suspicious)summary.push(`Administrator previously confirmed similar activity suspicious (${suspicious}-point risk signal).`);
 return {summary,safeAdjustment:safe,suspiciousAdjustment:suspicious};
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
