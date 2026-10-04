import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTenantAutomaticMonitoring } from "@/lib/tenantCapability";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getSupabaseAdmin();

  // Only re-test connected Microsoft tenants currently in CSV mode.
  // manual:* records have never completed Microsoft admin consent and are skipped.
  const { data: tenants, error } = await db
    .from("microsoft_tenants")
    .select("id,organization_id,tenant_id,tenant_name,automatic_monitoring_available")
    .eq("automatic_monitoring_available", false);

  if (error) throw error;

  const results: any[] = [];
  for (const tenant of tenants || []) {
    if (String(tenant.tenant_id).startsWith("manual:")) continue;

    const result = await checkTenantAutomaticMonitoring({
      organizationId: tenant.organization_id,
      microsoftTenantRecordId: tenant.id,
      microsoftTenantId: tenant.tenant_id,
    });

    results.push({
      id: tenant.id,
      tenant: tenant.tenant_name || tenant.tenant_id,
      available: result.available,
      upgraded: result.changed,
      nonPremium: result.nonPremium === true,
      transientError: result.transientError || null,
    });
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    upgraded: results.filter((r) => r.upgraded).length,
    results,
  });
}
