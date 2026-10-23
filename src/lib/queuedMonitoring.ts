import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";
import { acquireTenantSyncLock, releaseTenantSyncLock } from "@/lib/syncLock";
import { syncMicrosoftTenant } from "@/lib/graphSync";
import { syncGoogleWorkspaceTenant } from "@/lib/googleSync";
import { processProviderIncidents } from "@/lib/incidents";
import { getOrganizationNotificationSettings } from "@/lib/notificationSettings";
import { sendConsolidatedIncidentAlert, type AlertCandidate } from "@/lib/emailAlerts";
import { markMonitoringHealthy, recordMonitoringFailure } from "@/lib/monitoringHealth";

type Job = {id:string;organization_id:string;provider:"microsoft"|"google";tenant_record_id:string;lease_token:string;attempts:number};
const db = () => getSupabaseAdmin();
const fail = (e:unknown) => e instanceof Error ? e.message : String(e);

// Stable five-minute offsets distribute tenants throughout their monitoring interval.
function tenantOffset(id:string, intervalHours:number) {
  let hash=2166136261;
  for(const ch of id) hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  return (hash % (intervalHours*12))*300000;
}
function dueForSync(id:string,lastSync:string|null|undefined,intervalHours:number,now:number) {
  const period=intervalHours*3600000;
  const offset=tenantOffset(id,intervalHours);
  const slot=Math.floor((now-offset)/period)*period+offset;
  const previous=lastSync?Date.parse(lastSync):NaN;
  return {due:now>=slot && (!Number.isFinite(previous) || previous<slot),scheduledFor:new Date(slot).toISOString()};
}

// Five-minute scheduler; the unique job key prevents duplicate enqueue attempts.
export async function enqueueDueMonitoringJobs() {
  const client=db();
  let {data:settings,error:settingsError}=await client.from("organization_notification_settings")
    .select("organization_id,monitoring_interval_hours").eq("automatic_monitoring_enabled",true);
  // Safe rollout: older databases run with the new three-hour default until migration is applied.
  if(settingsError?.code==="42703" || settingsError?.code==="PGRST204"){
    const fallback=await client.from("organization_notification_settings")
      .select("organization_id").eq("automatic_monitoring_enabled",true);
    settings=fallback.data as any;
    settingsError=fallback.error;
  }
  if(settingsError) throw settingsError;
  const intervalByOrg=new Map((settings||[]).map((s:any)=>[String(s.organization_id),[1,3,6,12].includes(s.monitoring_interval_hours)?s.monitoring_interval_hours:3]));
  const ids=[...new Set((settings||[]).map((r:any)=>String(r.organization_id)))];
  if(!ids.length) return {eligibleOrganizations:0,queued:0};
  const {data:orgs,error:orgError}=await client.from("organizations")
    .select("id,name,plan,subscription_status,trial_started_at,trial_ends_at").in("id",ids);
  if(orgError) throw orgError;
  const eligible=(orgs||[]).filter((o:any)=>subscriptionState(o).writable);
  const now=Date.now();
  let queued=0;
  for(const org of eligible){
    const [m,g]=await Promise.all([
      client.from("microsoft_tenants").select("id,last_sync_at").eq("organization_id",org.id).eq("automatic_monitoring_available",true),
      client.from("google_workspace_tenants").select("id,last_sync_at").eq("organization_id",org.id),
    ]);
    if(m.error) throw m.error;
    if(g.error) throw g.error;
    const interval=intervalByOrg.get(String(org.id))||3;
    const jobs=[...(m.data||[]).map((t:any)=>({t,provider:"microsoft" as const})),
      ...(g.data||[]).map((t:any)=>({t,provider:"google" as const}))]
      .map(({t,provider})=>({provider,t,due:dueForSync(t.id,t.last_sync_at,interval,now)}))
      .filter(x=>x.due.due)
      .map(({t,provider,due})=>({organization_id:org.id,provider,tenant_record_id:t.id,scheduled_for:due.scheduledFor}));
    for(let i=0;i<jobs.length;i+=200){
      const {error}=await client.from("monitoring_jobs").upsert(jobs.slice(i,i+200),{
        onConflict:"organization_id,provider,tenant_record_id,scheduled_for",ignoreDuplicates:true
      });
      if(error) throw error;
    }
    queued+=jobs.length;
  }
  return {eligibleOrganizations:eligible.length,scheduledTenantSlots:queued};
}

async function executeJob(job:Job):Promise<{ok:boolean;reason?:string;candidates:AlertCandidate[]}> {
  const client=db();
  let lockToken:string|null=null;
  let providerSyncSucceeded=false;
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
      providerSyncSucceeded=true;
      await markMonitoringHealthy("microsoft",t.id);
      const result=await processProviderIncidents({organizationId:job.organization_id,provider:"microsoft",tenantRecordId:t.id,tenantName:t.tenant_name||t.tenant_id,since,sendAlerts:false});
      return {ok:true,candidates:result.alertCandidates||[]};
    }
    const {data:t,error}=await client.from("google_workspace_tenants")
      .select("*").eq("id",job.tenant_record_id).eq("organization_id",job.organization_id).maybeSingle();
    if(error) throw error;
    if(!t) return {ok:true,reason:"Tenant deleted",candidates:[]};
    const since=t.last_sync_at||undefined;
    await syncGoogleWorkspaceTenant(t,{automatic:true});
    providerSyncSucceeded=true;
    await markMonitoringHealthy("google",t.id);
    const result=await processProviderIncidents({organizationId:job.organization_id,provider:"google",tenantRecordId:t.id,tenantName:t.display_name||t.primary_domain||"Google Workspace",since,sendAlerts:false});
    return {ok:true,candidates:result.alertCandidates||[]};
  } catch(e){
    // Background failures must update the same tenant health fields as manual sync.
    // Otherwise an expired refresh token is silently displayed as Healthy indefinitely.
    try {
      if(providerSyncSucceeded) {
        console.error(`[queue] ${job.organization_id}/${job.provider}/${job.tenant_record_id}: post-sync processing failed: ${fail(e)}`);
        return {ok:false,reason:fail(e),candidates:[]};
      }
      const tenantTable=job.provider==="google"?"google_workspace_tenants":"microsoft_tenants";
      const {data:tenant}=await client.from(tenantTable)
        .select(job.provider==="google"?"id,display_name,primary_domain":"id,tenant_name,tenant_id")
        .eq("id",job.tenant_record_id).eq("organization_id",job.organization_id).maybeSingle();
      if(tenant){
        const record=tenant as any;
        await recordMonitoringFailure({provider:job.provider,organizationId:job.organization_id,
          tenantId:record.id,tenantName:record.display_name||record.tenant_name||record.primary_domain||record.tenant_id||"Tenant",
          error:e,sendAlert:true});
      }
    } catch(healthError){console.error(`[queue] health update failed: ${fail(healthError)}`);}
    return {ok:false,reason:fail(e),candidates:[]};
  }
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
