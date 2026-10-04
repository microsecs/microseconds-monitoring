import { NextRequest,NextResponse } from "next/server";
import {getSupabaseAdmin,getOrCreateDevOrganization} from "@/lib/supabaseAdmin";
import {syncGoogleWorkspaceTenant} from "@/lib/googleSync";
import {processProviderIncidents} from "@/lib/incidents";
import {markMonitoringHealthy,recordMonitoringFailure} from "@/lib/monitoringHealth";
export const dynamic="force-dynamic";
export async function POST(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,org=await getOrCreateDevOrganization(),sb=getSupabaseAdmin();
  const {data,error}=await sb.from("google_workspace_tenants").select("*").eq("id",id).eq("organization_id",org.id).single();
  if(error||!data)return NextResponse.json({error:"Google Workspace tenant not found"},{status:404});
  const previousLastSync=data.last_sync_at||undefined;
  const result=await syncGoogleWorkspaceTenant(data);
  const incidents=await processProviderIncidents({
   organizationId:org.id,provider:"google",tenantRecordId:data.id,
   tenantName:data.display_name||data.primary_domain||"Google Workspace",
   since:previousLastSync,sendAlerts:false
  });
  await markMonitoringHealthy("google",data.id);
  return NextResponse.json({...result,incidentsCreated:incidents.created,alertsSent:0,
   note:"Manual Google sync analyzes incidents but does not send email alerts."});
  }catch(e:any){
  try{
   const {id}=await params,org=await getOrCreateDevOrganization(),sb=getSupabaseAdmin();
   const {data}=await sb.from("google_workspace_tenants").select("id,display_name,primary_domain").eq("id",id).eq("organization_id",org.id).maybeSingle();
   if(data) await recordMonitoringFailure({provider:"google",organizationId:org.id,tenantId:data.id,tenantName:data.display_name||data.primary_domain||"Google Workspace",error:e,sendAlert:false});
  }catch{}
  return NextResponse.json({error:e?.message||"Google sync failed"},{status:500});
 }
}
