import {enforceSignInRetention} from "@/lib/retention";
import {NextRequest,NextResponse} from "next/server";
import {getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {syncMicrosoftTenant} from "@/lib/graphSync";
import {syncGoogleWorkspaceTenant} from "@/lib/googleSync";
import {processProviderIncidents} from "@/lib/incidents";

export const maxDuration = 300;

async function runMonitor(req:NextRequest){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)
   return NextResponse.json({error:"Unauthorized"},{status:401});
  const db=getSupabaseAdmin();
  const {data:settings,error:settingsError}=await db.from("organization_notification_settings")
   .select("organization_id,automatic_monitoring_enabled").eq("automatic_monitoring_enabled",true);
  if(settingsError)throw settingsError;
  const organizationIds=[...new Set((settings||[]).map((x:any)=>x.organization_id).filter(Boolean))];
  const allResults:any[]=[]; const retentionResults:any[]=[];

  for(const organizationId of organizationIds){
   const [m,g]=await Promise.all([
    db.from("microsoft_tenants").select("id,tenant_id,tenant_name,last_sync_at").eq("organization_id",organizationId).eq("automatic_monitoring_available",true),
    db.from("google_workspace_tenants").select("*").eq("organization_id",organizationId)
   ]);
   if(m.error)throw m.error;if(g.error)throw g.error;

   for(const tenant of m.data||[]){
    try{
     const sync=await syncMicrosoftTenant({organizationId,microsoftTenantRecordId:tenant.id,microsoftTenantId:tenant.tenant_id});
     const incidents=await processProviderIncidents({organizationId,provider:"microsoft",tenantRecordId:tenant.id,
      tenantName:tenant.tenant_name||tenant.tenant_id,since:tenant.last_sync_at||undefined,sendAlerts:true});
     allResults.push({organizationId,platform:"Microsoft 365",tenant:tenant.tenant_name||tenant.tenant_id,ok:true,...sync,incidentsCreated:incidents.created,alertsSent:incidents.alerted});
    }catch(e:any){allResults.push({organizationId,platform:"Microsoft 365",tenant:tenant.tenant_name||tenant.tenant_id,ok:false,error:e?.message||"Automatic sync failed"});}
   }

   for(const tenant of g.data||[]){
    try{
     const previousLastSync=tenant.last_sync_at||undefined;
     const sync=await syncGoogleWorkspaceTenant(tenant);
     const incidents=await processProviderIncidents({organizationId,provider:"google",tenantRecordId:tenant.id,
      tenantName:tenant.display_name||tenant.primary_domain||"Google Workspace",since:previousLastSync,sendAlerts:true});
     allResults.push({organizationId,platform:"Google Workspace",tenant:tenant.display_name||tenant.primary_domain||"Google Workspace",ok:true,...sync,incidentsCreated:incidents.created,alertsSent:incidents.alerted});
    }catch(e:any){allResults.push({organizationId,platform:"Google Workspace",tenant:tenant.display_name||tenant.primary_domain||"Google Workspace",ok:false,error:e?.message||"Automatic sync failed"});}
   }
   retentionResults.push({organizationId,...await enforceSignInRetention(organizationId)});
  }
  return NextResponse.json({ok:true,organizationsProcessed:organizationIds.length,results:allResults,retention:retentionResults});
 }catch(e:any){return NextResponse.json({error:e?.message||"Automatic monitoring failed"},{status:500});}
}


// Vercel Cron invokes scheduled routes with GET. Keep POST as well for local/manual use.
export async function GET(req:NextRequest){ return runMonitor(req); }
export async function POST(req:NextRequest){ return runMonitor(req); }
