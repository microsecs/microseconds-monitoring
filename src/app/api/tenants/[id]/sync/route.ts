import { NextRequest, NextResponse } from "next/server";
import { requireWritableOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { syncMicrosoftTenant } from "@/lib/graphSync";
import { processTenantIncidents } from "@/lib/incidents";
import { markMonitoringHealthy, recordMonitoringFailure } from "@/lib/monitoringHealth";

function isNonPremiumError(message: string) {
  const s = message.toLowerCase();
  return (
    s.includes("authentication_requestfromnonpremiumtenantorb2ctenant") ||
    s.includes("premium license") ||
    s.includes("nonpremiumtenant")
  );
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const { data: tenant, error } = await supabase
      .from("microsoft_tenants")
      .select("id,tenant_id,tenant_name,last_sync_at")
      .eq("id", id)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (error) throw error;
    if (!tenant) {
      return NextResponse.json({ error: "Microsoft tenant not found." }, { status: 404 });
    }

    if (String(tenant.tenant_id).startsWith("manual:")) {
      return NextResponse.json(
        { error: "This tenant is configured for CSV monitoring only." },
        { status: 400 }
      );
    }

    try {
      const result = await syncMicrosoftTenant({
        organizationId: org.id,
        microsoftTenantRecordId: tenant.id,
        microsoftTenantId: tenant.tenant_id,
        top: 250,
      });

      // Analyze the newly synchronized window using the same incident engine
      // used by CSV imports. The incident engine itself includes a safety overlap
      // and deduplicates incidents by sign-in ID.
      const incidentResult = await processTenantIncidents({
        organizationId: org.id,
        microsoftTenantRecordId: tenant.id,
        tenantName: tenant.tenant_name || tenant.tenant_id,
        since: tenant.last_sync_at || undefined,
        sendAlerts: false,
      });

      await markMonitoringHealthy("microsoft", tenant.id);
      return NextResponse.json({
        ok: true,
        tenant: tenant.tenant_name || tenant.tenant_id,
        ...result,
        incidentsCreated: incidentResult.created,
        alertsSent: incidentResult.alerted,
      });
    } catch (e: any) {
      const message = e?.message || "Microsoft Graph sync failed.";
      await recordMonitoringFailure({
        provider:"microsoft",organizationId:org.id,tenantId:tenant.id,
        tenantName:tenant.tenant_name || tenant.tenant_id,error:e,sendAlert:false
      });

      if (isNonPremiumError(message)) {
        await supabase
          .from("microsoft_tenants")
          .update({ automatic_monitoring_available: false })
          .eq("id", tenant.id);

        return NextResponse.json(
          {
            error:
              "Automatic monitoring is not available for this tenant. Microsoft reports that the tenant does not have the required Entra ID P1/P2 licensing. Use CSV monitoring instead.",
            nonPremium: true,
          },
          { status: 403 }
        );
      }

      throw e;
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not synchronize Microsoft sign-ins." },
      { status: 500 }
    );
  }
}
