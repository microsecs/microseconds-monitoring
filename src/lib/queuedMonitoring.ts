import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";
import { acquireTenantSyncLock, releaseTenantSyncLock } from "@/lib/syncLock";
import { syncMicrosoftTenant } from "@/lib/graphSync";
import { syncGoogleWorkspaceTenant } from "@/lib/googleSync";
import { processProviderIncidents } from "@/lib/incidents";
import { getOrganizationNotificationSettings } from "@/lib/notificationSettings";
import { sendConsolidatedIncidentAlert, type AlertCandidate } from "@/lib/emailAlerts";

type Job = {id:string;organization_id:string;provider:"microsoft"|"google";tenant_record_id:string;lease_token:string;attempts:number};
const db = () => getSupabaseAdmin();
const fail = (e:unknown) => e instanceof Error ? e.message : String(e);

// Every scheduled hour has a unique key. Multiple cron invocations may enqueue safely.
export async function enqueueDueMonitoringJobs() {
  const client=db();
  const {data:settings,error:settingsError}=await client.from("organization_notification_settings")
    .select("organization_id").eq("automatic_monitoring_enabled",true);
  if(settingsError) throw settingsError;
  const ids=[...new Set((settings||[]).map((r:any)=>String(r.organization_id)))];
  if(!ids.length) return {eligibleOrganizations:0,queued:0};
  const {data:orgs,error:orgError}=await client.from("organizations")
    .select("id,name,plan,subscription_status,trial_started_at,trial_ends_at").in("id",ids);
  if(orgError) throw orgError;
  const eligible=(orgs||[]).filter((o:any)=>subscriptionState(o).writable);
  const scheduledFor=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
  let queued=0;
  for(const org of eligible){
    const [m,g]=await Promise.all([
      client.from("microsoft_tenants").select("id").eq("organization_id",org.id).eq("automatic_monitoring_available",true),
      client.from("google_workspace_tenants").select("id").eq("organization_id",org.id),
    ]);
    if(m.error) throw m.error;
    if(g.error) throw g.error;
    const jobs=[...(m.data||[]).map((t:any)=>({organization_id:org.id,provider:"microsoft",tenant_record_id:t.id,scheduled_for:scheduledFor})),
      ...(g.data||[]).map((t:any)=>({organization_id:org.id,provider:"google",tenant_record_id:t.id,scheduled_for:scheduledFor}))];
    for(let i=0;i<jobs.length;i+=200){
      const {error}=await client.from("monitoring_jobs").upsert(jobs.slice(i,i+200),{
        onConflict:"organization_id,provider,tenant_record_id,scheduled_for",ignoreDuplicates:true
      });
      if(error) throw error;
    }
    queued+=jobs.length;
  }
  return {eligibleOrganizations:eligible.length,scheduledFor,scheduledTenantSlots:queued};
}

async function executeJob(job:Job):Promise<{ok:boolean;reason?:string;candidates:AlertCandidate[]}> {
  const client=db();
  let lockToken:string|null=null;
  try {
    // A queued job is not permission to process a now-disabled or expired customer.
    const {data:org,error:orgError}=await client.from("organizations")
      .select("id,plan,subscription_status,trial_started_at,trial_ends_at").eq("id",job.organization_id).single();
    if(orgError) throw orgError;
    const {data:settings,error:settingsError}=await client.from("organization_notification_settings")
      .select("automatic_monitoring_enabled").eq("organization_id",job.organization_id).maybeSingle();
    if(settingsError) throw settingsError;
    if(!org || !subscriptionState(org).writable || !settings?.automatic_monitoring_enabled){
      return {ok:true,reason:"Monitoring disabled or subscription inactive",candidates:[]};
    }
    lockToken=await acquireTenantSyncLock(job.provider,job.tenant_record_id,job.organization_id);
    if(!lockToken) throw new Error("Tenant sync is already in progress");
    if(job.provider==="microsoft"){
      const {data:t,error}=await client.from("microsoft_tenants")
        .select("id,tenant_id,tenant_name,last_sync_at,automatic_monitoring_available")
        .eq("id",job.tenant_record_id).eq("organization_id",job.organization_id).maybeSingle();
      if(error) throw error;
      if(!t?.automatic_monitoring_available) return {ok:true,reason:"Tenant unavailable",candidates:[]};
      let since=t.last_sync_at||undefined;
      if(!since){
        const {data:imp,error:impError}=await client.from("imports")
          .select("imported_at").eq("organization_id",job.organization_id)
          .eq("microsoft_tenant_id",job.tenant_record_id).eq("source","csv")
          .order("imported_at",{ascending:false}).limit(1).maybeSingle();
        if(impError) throw impError;
        since=imp?.imported_at||undefined;
      }
      await syncMicrosoftTenant({organizationId:job.organization_id,microsoftTenantRecordId:t.id,microsoftTenantId:t.tenant_id,since});
      const result=await processProviderIncidents({organizationId:job.organization_id,provider:"microsoft",tenantRecordId:t.id,tenantName:t.tenant_name||t.tenant_id,since,sendAlerts:false});
      return {ok:true,candidates:result.alertCandidates||[]};
    }
    const {data:t,error}=await client.from("google_workspace_tenants")
      .select("*").eq("id",job.tenant_record_id).eq("organization_id",job.organization_id).maybeSingle();
    if(error) throw error;
    if(!t) return {ok:true,reason:"Tenant deleted",candidates:[]};
    const since=t.last_sync_at||undefined;
    await syncGoogleWorkspaceTenant(t,{automatic:true});
    const result=await processProviderIncidents({organizationId:job.organization_id,provider:"google",tenantRecordId:t.id,tenantName:t.display_name||t.primary_domain||"Google Workspace",since,sendAlerts:false});
    return {ok:true,candidates:result.alertCandidates||[]};
  } catch(e){return {ok:false,reason:fail(e),candidates:[]};}
  finally {if(lockToken) await releaseTenantSyncLock(job.provider,job.tenant_record_id,lockToken);}
}

export async function runQueuedMonitoring(options:{sendAlerts?:boolean}={}){
  const start=Date.now();
  const scheduled=await enqueueDueMonitoringJobs();
  const candidates=new Map<string,AlertCandidate[]>();
  const stats={claimed:0,completed:0,failed:0,skipped:0,alertsSent:0};
  // Three bounded concurrent provider syncs; continue claiming while budget remains.
  while(Date.now()-start<210000){
    const {data:jobs,error}=await db().rpc("claim_monitoring_jobs",{p_limit:3,p_lease_minutes:12});
    if(error) throw error;
    if(!jobs?.length) break;
    stats.claimed+=jobs.length;
    await Promise.all((jobs as Job[]).map(async job=>{
      const result=await executeJob(job);
      const {data:finished,error:finishError}=await db().rpc("finish_monitoring_job",{
        p_job_id:job.id,p_lease_token:job.lease_token,p_success:result.ok,p_error:result.reason||null
      });
      if(finishError || finished!==true) console.error(`[queue] ${job.organization_id}/${job.tenant_record_id}: lease completion failed`,finishError?.message);
      if(result.ok){stats.completed++;if(result.reason)stats.skipped++;}
      else {stats.failed++;console.error(`[queue] ${job.organization_id}/${job.provider}/${job.tenant_record_id}: ${result.reason}`);}
      if(result.ok && result.candidates.length){
        candidates.set(job.organization_id,[...(candidates.get(job.organization_id)||[]),...result.candidates]);
      }
    }));
  }
  // Per-org batching within this invocation; incident_email_alert_log deduplicates retries.
  if(options.sendAlerts){
    for(const [organizationId,items] of candidates){
      try {
        const settings=await getOrganizationNotificationSettings(organizationId);
        if(settings.enabled&&settings.alert_successful_suspicious){
          const result=await sendConsolidatedIncidentAlert({organizationId,recipients:settings.alert_emails,candidates:items});
          stats.alertsSent+=result.sent;
        }
      }catch(e){console.error(`[queue] ${organizationId}: alert dispatch failed: ${fail(e)}`);}
    }
  }
  console.log(`[queue] SUMMARY ${JSON.stringify({scheduled,...stats,durationMs:Date.now()-start})}`);
  return {ok:true,scheduled,...stats,durationMs:Date.now()-start};
}
