import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDevOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { processTenantIncidents } from "@/lib/incidents";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const microsoftTenantId = String(body?.microsoftTenantId || "").trim();
    const since = body?.since ? String(body.since) : undefined;

    if (!microsoftTenantId) {
      return NextResponse.json({ error: "Tenant is required." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const org = await getOrCreateDevOrganization();

    const { data: tenant, error } = await db
      .from("microsoft_tenants")
      .select("id,tenant_id,tenant_name")
      .eq("id", microsoftTenantId)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (error) throw error;
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const result = await processTenantIncidents({
      organizationId: org.id,
      microsoftTenantRecordId: tenant.id,
      tenantName: tenant.tenant_name || tenant.tenant_id,
      since,
    });

    return NextResponse.json({
      ok: true,
      incidentsCreated: result.created,
      alertsSent: result.alerted,
      notificationSource: result.notificationSource,
    });
  } catch (e: any) {
    console.error("CSV incident processing failed:", e);
    return NextResponse.json(
      { error: e?.message || "Incident processing failed." },
      { status: 500 }
    );
  }
}
