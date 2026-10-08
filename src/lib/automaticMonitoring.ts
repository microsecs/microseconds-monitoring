import { enforceSignInRetention } from "@/lib/retention";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { syncMicrosoftTenant } from "@/lib/graphSync";
import { syncGoogleWorkspaceTenant } from "@/lib/googleSync";
import { processProviderIncidents } from "@/lib/incidents";
import { subscriptionState } from "@/lib/subscription";
import { acquireTenantSyncLock, releaseTenantSyncLock } from "@/lib/syncLock";
import { sendConsolidatedIncidentAlert, AlertCandidate } from "@/lib/emailAlerts";
import { getOrganizationNotificationSettings } from "@/lib/notificationSettings";

export async function runAutomaticMonitoring(options:{sendAlerts?:boolean}={}) {
  const sendAlerts=options.sendAlerts===true;
  const startedAt = new Date();
  // Keep a safety margin below Vercel's 300s function ceiling so we can finish
  // the current organization, send its alert batch, and return cleanly.
  const MONITORING_BUDGET_MS = 255_000;
  const budgetRemaining = () => MONITORING_BUDGET_MS - (Date.now() - startedAt.getTime());
  let stoppedForBudget = false;
  const db = getSupabaseAdmin();
  const { data: settings, error: settingsError } = await db.from("organization_notification_settings")
    .select("organization_id,automatic_monitoring_enabled").eq("automatic_monitoring_enabled", true);
  if (settingsError) throw settingsError;

  const candidateOrganizationIds = [...new Set((settings || []).map((x: any) => x.organization_id).filter(Boolean))];
  const { data: orgRows, error: orgError } = candidateOrganizationIds.length
    ? await db.from("organizations").select("id,name,plan,subscription_status,trial_started_at,trial_ends_at").in("id", candidateOrganizationIds)
    : { data: [], error: null };
  if (orgError) throw orgError;

  const eligibleOrganizations = (orgRows || []).filter((org: any) => subscriptionState(org).writable);
  const organizationIds = eligibleOrganizations.map((org: any) => org.id);
  const organizationNameById = new Map((orgRows || []).map((org:any) => [org.id, org.name || org.id]));

  for (const org of orgRows || []) {
    const state = subscriptionState(org);
    if (!state.writable) {
      console.warn(`[monitor] ORG - ${org.name || org.id}: SKIPPED — subscription status ${state.status}`);
    }
  }
  const results: any[] = [];
  const retention: any[] = [];

  const logTenantResult = (r: any) => {
    const orgName = organizationNameById.get(r.organizationId) || r.organizationId || "Unknown organization";
    if (r.skipped) {
      console.log(`[monitor] ${orgName} / ${r.platform} - ${r.tenant}: SKIPPED — ${r.reason || "No reason supplied"}`);
    } else if (!r.ok) {
      console.error(`[monitor] ${orgName} / ${r.platform} - ${r.tenant}: FAILED — ${r.error || "Unknown error"}`);
    } else {
      const details = [
        typeof r.saved === "number" ? `${r.saved} saved` : null,
        typeof r.newEvents === "number" ? `${r.newEvents} new` : null,
        typeof r.incidentsCreated === "number" ? `${r.incidentsCreated} incident(s)` : null,
      ].filter(Boolean).join(", ");
      console.log(`[monitor] ${orgName} / ${r.platform} - ${r.tenant}: SYNCED${details ? ` — ${details}` : ""}`);
    }
  };

  for (const organizationId of organizationIds) {
    if (budgetRemaining() < 45_000) {
      stoppedForBudget = true;
      console.warn(`[monitor] BUDGET — stopping before organization ${organizationNameById.get(organizationId) || organizationId}; ${Math.max(0, budgetRemaining())}ms remain. Unprocessed tenants stay eligible for the next hourly run.`);
      break;
    }
    const organizationAlertCandidates:AlertCandidate[]=[];
    const [m, g] = await Promise.all([
      db.from("microsoft_tenants").select("id,tenant_id,tenant_name,last_sync_at").eq("organization_id", organizationId).eq("automatic_monitoring_available", true),
      db.from("google_workspace_tenants").select("*").eq("organization_id", organizationId),
    ]);
    if (m.error) throw m.error;
    if (g.error) throw g.error;

    // For Microsoft tenants transitioning from CSV monitoring, the most recent
    // CSV import is a safe first incremental checkpoint. This avoids a large
    // first Graph history request after Entra licensing becomes available.
    const microsoftIds = (m.data || []).map((t:any) => t.id);
    const csvCheckpointByTenant = new Map<string,string>();
    if (microsoftIds.length) {
      const { data: imports, error: importsError } = await db.from("imports")
        .select("microsoft_tenant_id,imported_at")
        .eq("organization_id", organizationId)
        .eq("source", "csv")
        .in("microsoft_tenant_id", microsoftIds)
        .order("imported_at", { ascending: false });
      if (importsError) throw importsError;
      for (const row of imports || []) {
        if (row.microsoft_tenant_id && !csvCheckpointByTenant.has(row.microsoft_tenant_id)) {
          csvCheckpointByTenant.set(row.microsoft_tenant_id, row.imported_at);
        }
      }
    }

    // Oldest/never-synced tenants first prevents a repeatedly slow tenant from
    // starving tenants that have gone the longest without monitoring.
    const microsoftTenants = [...(m.data || [])].sort((a:any,b:any) =>
      new Date(a.last_sync_at || 0).getTime() - new Date(b.last_sync_at || 0).getTime()
    );
    const googleTenants = [...(g.data || [])].sort((a:any,b:any) =>
      new Date(a.last_sync_at || 0).getTime() - new Date(b.last_sync_at || 0).getTime()
    );

    for (const tenant of microsoftTenants) {
      if (budgetRemaining() < 45_000) { stoppedForBudget = true; console.warn(`[monitor] ${organizationNameById.get(organizationId) || organizationId} / Microsoft 365 - ${tenant.tenant_name || tenant.tenant_id}: DEFERRED — cron safety budget reached; will retry next hourly run`); break; }
      const lockToken = await acquireTenantSyncLock("microsoft", tenant.id, organizationId);
      if (!lockToken) {
        const result = { organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: true, skipped: true, reason: "Sync already in progress" };
        results.push(result); logTenantResult(result); continue;
      }
      try {
        const syncSince = tenant.last_sync_at || csvCheckpointByTenant.get(tenant.id) || undefined;
        const sync = await syncMicrosoftTenant({ organizationId, microsoftTenantRecordId: tenant.id, microsoftTenantId: tenant.tenant_id, since: syncSince });
        const incidents = await processProviderIncidents({
          organizationId, provider: "microsoft", tenantRecordId: tenant.id,
          tenantName: tenant.tenant_name || tenant.tenant_id, since: syncSince, sendAlerts: false,
        });
        organizationAlertCandidates.push(...(incidents.alertCandidates||[]));
        const result = { organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: true, ...sync, incidentsCreated: incidents.created, alertsSent: incidents.alerted };
        results.push(result); logTenantResult(result);
      } catch (e: any) {
        const result = { organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: false, error: e?.message || "Automatic sync failed" };
        results.push(result); logTenantResult(result);
      } finally { await releaseTenantSyncLock("microsoft", tenant.id, lockToken); }
    }

    for (const tenant of googleTenants) {
      if (budgetRemaining() < 45_000) { stoppedForBudget = true; console.warn(`[monitor] ${organizationNameById.get(organizationId) || organizationId} / Google Workspace - ${tenant.display_name || tenant.primary_domain || "Google Workspace"}: DEFERRED — cron safety budget reached; will retry next hourly run`); break; }
      const lockToken = await acquireTenantSyncLock("google", tenant.id, organizationId);
      if (!lockToken) {
        const result = { organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: true, skipped: true, reason: "Sync already in progress" };
        results.push(result); logTenantResult(result); continue;
      }
      try {
        const previousLastSync = tenant.last_sync_at || undefined;
        const sync = await syncGoogleWorkspaceTenant(tenant, { automatic: true });
        const incidents = await processProviderIncidents({
          organizationId, provider: "google", tenantRecordId: tenant.id,
          tenantName: tenant.display_name || tenant.primary_domain || "Google Workspace", since: previousLastSync, sendAlerts: false,
        });
        organizationAlertCandidates.push(...(incidents.alertCandidates||[]));
        const result = { organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: true, ...sync, incidentsCreated: incidents.created, alertsSent: incidents.alerted };
        results.push(result); logTenantResult(result);
      } catch (e: any) {
        const result = { organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: false, error: e?.message || "Automatic sync failed" };
        results.push(result); logTenantResult(result);
      } finally { await releaseTenantSyncLock("google", tenant.id, lockToken); }
    }
    if(sendAlerts){
      const notificationSettings=await getOrganizationNotificationSettings(organizationId);
      console.log(`[alerts] ${organizationId}: automatic run collected ${organizationAlertCandidates.length} candidate incident(s); enabled=${notificationSettings.enabled}; successfulAlerts=${notificationSettings.alert_successful_suspicious}; recipients=${notificationSettings.alert_emails.length}`);
      if(notificationSettings.enabled && notificationSettings.alert_successful_suspicious){
        const batch=await sendConsolidatedIncidentAlert({organizationId,recipients:notificationSettings.alert_emails,candidates:organizationAlertCandidates});
        results.push({organizationId,platform:"Email",tenant:"Consolidated security alert",ok:true,emailsSent:batch.sent,incidentsAlerted:batch.incidentsAlerted,emailReason:(batch as any).reason||null});
      } else {
        console.log(`[alerts] ${organizationId}: email alerts disabled by organization settings`);
        results.push({organizationId,platform:"Email",tenant:"Consolidated security alert",ok:true,skipped:true,reason:"Email alerts disabled"});
      }
    }
    retention.push({ organizationId, ...await enforceSignInRetention(organizationId) });
  }

  const finishedAt = new Date();
  const tenantResults = results.filter((r: any) => r.platform !== "Email");
  const synced = tenantResults.filter((r: any) => r.ok && !r.skipped).length;
  const skipped = tenantResults.filter((r: any) => r.skipped).length;
  const failed = tenantResults.filter((r: any) => !r.ok).length;
  console.log(`[monitor] SUMMARY — ${tenantResults.length} tenant(s) checked across ${new Set(tenantResults.map((r:any)=>r.organizationId)).size}/${organizationIds.length} eligible organization(s): ${synced} synced, ${skipped} skipped, ${failed} failed; subscriptionSkipped=${candidateOrganizationIds.length - organizationIds.length}; budgetStop=${stoppedForBudget}`);

  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    organizationsProcessed: new Set(tenantResults.map((r:any)=>r.organizationId)).size,
    stoppedForBudget,
    organizationsSkippedForSubscription: candidateOrganizationIds.length - organizationIds.length,
    tenantsProcessed: tenantResults.length,
    tenantsSynced: synced,
    tenantsSkipped: skipped,
    successes: synced,
    failures: failed,
    results,
    retention,
  };
}
