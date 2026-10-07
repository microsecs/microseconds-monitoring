import { getAppAccessToken, getRecentSignIns } from "@/lib/graph";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function checkTenantAutomaticMonitoring(params:{organizationId:string;microsoftTenantRecordId:string;microsoftTenantId:string}) {
  if(String(params.microsoftTenantId).startsWith("manual:")) return {available:false,manual:true,changed:false};
  const db=getSupabaseAdmin();
  try{
    const token=await getAppAccessToken(params.microsoftTenantId);
    await getRecentSignIns(token,1);
    const {data:current}=await db.from("microsoft_tenants").select("automatic_monitoring_available")
      .eq("id",params.microsoftTenantRecordId).eq("organization_id",params.organizationId).maybeSingle();
    const changed=current?.automatic_monitoring_available!==true;
    // A successful AuditLog request proves both application consent and the
    // tenant's current ability to use automatic sign-in monitoring. Clear any
    // stale timeout/problem state at the same time.
    const {error}=await db.from("microsoft_tenants").update({
      automatic_monitoring_available:true,
      connection_status:"healthy",
      last_sync_error:null,
      last_sync_error_at:null,
      health_alert_sent_at:null,
    }).eq("id",params.microsoftTenantRecordId).eq("organization_id",params.organizationId);
    if(error)throw error;
    return {available:true,manual:false,changed};
  }catch(e:any){
    const message=String(e?.message||"");
    const low=message.toLowerCase();
    const nonPremium=low.includes("authentication_requestfromnonpremiumtenantorb2ctenant")||low.includes("nonpremiumtenant");
    const timedOut=low.includes("timeout")||low.includes("aborted");
    if(nonPremium){
      await db.from("microsoft_tenants").update({automatic_monitoring_available:false})
        .eq("id",params.microsoftTenantRecordId).eq("organization_id",params.organizationId);
      return {available:false,manual:false,changed:false,nonPremium:true};
    }
    // Timeouts/transient provider failures must never downgrade or otherwise
    // mutate the tenant. The next check can safely retry.
    return {available:false,manual:false,changed:false,timedOut,transientError:message};
  }
}
