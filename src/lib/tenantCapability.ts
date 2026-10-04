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
    if(changed){
      const {error}=await db.from("microsoft_tenants").update({automatic_monitoring_available:true})
        .eq("id",params.microsoftTenantRecordId).eq("organization_id",params.organizationId);
      if(error)throw error;
    }
    return {available:true,manual:false,changed};
  }catch(e:any){
    const message=String(e?.message||"");
    const low=message.toLowerCase();
    const nonPremium=low.includes("authentication_requestfromnonpremiumtenantorb2ctenant")||low.includes("nonpremiumtenant");
    if(nonPremium){
      await db.from("microsoft_tenants").update({automatic_monitoring_available:false})
        .eq("id",params.microsoftTenantRecordId).eq("organization_id",params.organizationId);
      return {available:false,manual:false,changed:false,nonPremium:true};
    }
    return {available:false,manual:false,changed:false,transientError:message};
  }
}
