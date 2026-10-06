import { enforceSignInRetention } from "@/lib/retention";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { syncMicrosoftTenant } from "@/lib/graphSync";
import { syncGoogleWorkspaceTenant } from "@/lib/googleSync";
import { processProviderIncidents } from "@/lib/incidents";
import { subscriptionState } from "@/lib/subscription";
import { acquireTenantSyncLock, releaseTenantSyncLock } from "@/lib/syncLock";

export async function runAutomaticMonitoring() {
  const startedAt = new Date();
  const db = getSupabaseAdmin();
  const { data: settings, error: settingsError } = await db.from("organization_notification_settings")
    .select("organization_id,automatic_monitoring_enabled").eq("automatic_monitoring_enabled", true);
  if (settingsError) throw settingsError;

  const candidateOrganizationIds = [...new Set((settings || []).map((x: any) => x.organization_id).filter(Boolean))];
  const { data: orgRows, error: orgError } = candidateOrganizationIds.length
    ? await db.from("organizations").select("id,plan,subscription_status,trial_started_at,trial_ends_at").in("id", candidateOrganizationIds)
    : { data: [], error: null };
  if (orgError) throw orgError;

  const organizationIds = (orgRows || []).filter((org: any) => subscriptionState(org).writable).map((org: any) => org.id);
  const results: any[] = [];
  const retention: any[] = [];

  for (const organizationId of organizationIds) {
    const [m, g] = await Promise.all([
      db.from("microsoft_tenants").select("id,tenant_id,tenant_name,last_sync_at").eq("organization_id", organizationId).eq("automatic_monitoring_available", true),
      db.from("google_workspace_tenants").select("*").eq("organization_id", organizationId),
    ]);
    if (m.error) throw m.error;
    if (g.error) throw g.error;

    for (const tenant of m.data || []) {
      const lockToken = await acquireTenantSyncLock("microsoft", tenant.id, organizationId);
      if (!lockToken) { results.push({ organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: true, skipped: true, reason: "Sync already in progress" }); continue; }
      try {
        const sync = await syncMicrosoftTenant({ organizationId, microsoftTenantRecordId: tenant.id, microsoftTenantId: tenant.tenant_id });
        const incidents = await processProviderIncidents({
          organizationId, provider: "microsoft", tenantRecordId: tenant.id,
          tenantName: tenant.tenant_name || tenant.tenant_id, since: tenant.last_sync_at || undefined, sendAlerts: true,
        });
        results.push({ organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: true, ...sync, incidentsCreated: incidents.created, alertsSent: incidents.alerted });
      } catch (e: any) {
        results.push({ organizationId, platform: "Microsoft 365", tenant: tenant.tenant_name || tenant.tenant_id, ok: false, error: e?.message || "Automatic sync failed" });
      } finally { await releaseTenantSyncLock("microsoft", tenant.id, lockToken); }
    }

    for (const tenant of g.data || []) {
      const lockToken = await acquireTenantSyncLock("google", tenant.id, organizationId);
      if (!lockToken) { results.push({ organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: true, skipped: true, reason: "Sync already in progress" }); continue; }
      try {
        const previousLastSync = tenant.last_sync_at || undefined;
        const sync = await syncGoogleWorkspaceTenant(tenant);
        const incidents = await processProviderIncidents({
          organizationId, provider: "google", tenantRecordId: tenant.id,
          tenantName: tenant.display_name || tenant.primary_domain || "Google Workspace", since: previousLastSync, sendAlerts: true,
        });
        results.push({ organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: true, ...sync, incidentsCreated: incidents.created, alertsSent: incidents.alerted });
      } catch (e: any) {
        results.push({ organizationId, platform: "Google Workspace", tenant: tenant.display_name || tenant.primary_domain || "Google Workspace", ok: false, error: e?.message || "Automatic sync failed" });
      } finally { await releaseTenantSyncLock("google", tenant.id, lockToken); }
    }
    retention.push({ organizationId, ...await enforceSignInRetention(organizationId) });
  }

  const finishedAt = new Date();
  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    organizationsProcessed: organizationIds.length,
    organizationsSkippedForSubscription: candidateOrganizationIds.length - organizationIds.length,
    tenantsProcessed: results.length,
    successes: results.filter((r: any) => r.ok).length,
    failures: results.filter((r: any) => !r.ok).length,
    results,
    retention,
  };
}
