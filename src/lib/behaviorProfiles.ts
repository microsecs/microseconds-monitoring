import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Phase 2: observation-only behavior snapshots. These are NOT allowlists and
 * never alter incident eligibility, score, or the administrator's threshold.
 * Scoped by organization + provider + internal tenant + normalized user.
 */
export async function recordBehaviorProfile(x:{
 organizationId:string;provider:"microsoft"|"google";tenantRecordId:string;
 userPrincipalName:string;eventTime:string;ip?:string|null;city?:string|null;
 country?:string|null;application?:string|null;networkProvider?:string|null;asn?:string|null;
}){
 const user=x.userPrincipalName.trim().toLowerCase();
 if(!user||!x.organizationId||!x.tenantRecordId)return;
 const db=getSupabaseAdmin();
 const since=new Date(Date.now()-90*86400000).toISOString();
 let q=db.from("signins")
  .select("id,event_time,ip_address,city,country,app_name,status")
  .eq("organization_id",x.organizationId).ilike("user_principal_name",user)
  .ilike("status","success").gte("event_time",since)
  .lte("event_time",x.eventTime).order("event_time",{ascending:false}).limit(500);
 q=x.provider==="google"?q.eq("google_workspace_tenant_id",x.tenantRecordId):q.eq("microsoft_tenant_id",x.tenantRecordId);
 const {data,error}=await q;
 if(error)throw error;
 const rows=data||[];
 const counts=(field:"ip_address"|"city"|"country"|"app_name")=>{
  const map=new Map<string,number>();
  for(const r of rows){const v=String(r[field]||"").trim();if(v)map.set(v,(map.get(v)||0)+1);}
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([value,count])=>({value,count}));
 };
 const row={organization_id:x.organizationId,provider:x.provider,tenant_record_id:x.tenantRecordId,
  user_principal_name:user,observed_signins:rows.length,first_observed_at:rows.at(-1)?.event_time||x.eventTime,
  last_observed_at:rows[0]?.event_time||x.eventTime,ip_patterns:counts("ip_address"),
  city_patterns:counts("city"),country_patterns:counts("country"),application_patterns:counts("app_name"),
  last_network_provider:x.networkProvider||null,last_asn:x.asn||null,updated_at:new Date().toISOString()};
 const {error:saveError}=await db.from("user_behavior_profiles").upsert(row,{onConflict:"organization_id,provider,tenant_record_id,user_principal_name"});
 if(saveError)throw saveError;
}
