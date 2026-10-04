import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {checkTenantAutomaticMonitoring} from "@/lib/tenantCapability";

export async function POST(_req:NextRequest,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params; const db=getSupabaseAdmin(); const org=await getOrCreateDevOrganization();
    const {data:t,error}=await db.from("microsoft_tenants").select("id,tenant_id,tenant_name")
      .eq("id",id).eq("organization_id",org.id).maybeSingle();
    if(error)throw error;
    if(!t)return NextResponse.json({error:"Tenant not found."},{status:404});
    if(String(t.tenant_id).startsWith("manual:"))return NextResponse.json({available:false,manual:true,message:"This CSV-only tenant has not been connected to Microsoft yet."});
    const r=await checkTenantAutomaticMonitoring({organizationId:org.id,microsoftTenantRecordId:t.id,microsoftTenantId:t.tenant_id});
    return NextResponse.json({...r,message:r.available?(r.changed?"Entra licensing now supports automatic monitoring. Sync Now has been enabled.":"Automatic monitoring is available for this tenant."):r.nonPremium?"Microsoft still reports that automatic sign-in monitoring is not available for this tenant.":"Microsoft access could not be verified right now. The tenant's existing monitoring status was not downgraded."});
  }catch(e:any){return NextResponse.json({error:e?.message||"Could not check tenant capability."},{status:500});}
}
