import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOrCreateDevOrganization, requireWritableOrganization, getSupabaseAdmin, withSupabaseClockSkewRetry } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const org = await getOrCreateDevOrganization();

    const { data, error } = await withSupabaseClockSkewRetry(() => supabase
      .from("microsoft_tenants")
      .select("id,tenant_id,tenant_name,automatic_monitoring_available,connected_at,last_sync_at,connection_status,last_sync_error,last_sync_error_at,sort_order")
      .eq("organization_id", org.id)
      .order("sort_order", { ascending: true, nullsFirst: false }).order("connected_at", { ascending: true }));

    if (error) throw error;

    const tenants = data || [];
    const { data: recentImports, error: importsError } = await withSupabaseClockSkewRetry(() => supabase
      .from("imports")
      .select("microsoft_tenant_id,imported_at")
      .eq("organization_id", org.id)
      .eq("source", "csv")
      .order("imported_at", { ascending: false }));

    if (importsError) throw importsError;

    const latestImport = new Map<string, string>();
    for (const item of recentImports || []) {
      if (item.microsoft_tenant_id && !latestImport.has(item.microsoft_tenant_id)) {
        latestImport.set(item.microsoft_tenant_id, item.imported_at);
      }
    }

    return NextResponse.json({
      organization: { id: org.id, name: org.name },
      tenants: tenants.map((t: any) => ({
        ...t,
        last_csv_import_at: latestImport.get(t.id) || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not load Microsoft tenants." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantName = String(body?.tenantName || "").trim();
    const suppliedTenantId = String(body?.tenantId || "").trim();

    if (!tenantName) {
      return NextResponse.json(
        { error: "A tenant name is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const tenantId =
      suppliedTenantId ||
      `manual:${crypto.randomUUID()}`;

    const { data, error } = await supabase
      .from("microsoft_tenants")
      .insert({
        organization_id: org.id,
        tenant_id: tenantId,
        tenant_name: tenantName,
        automatic_monitoring_available: false,
      })
      .select("id,tenant_id,tenant_name,automatic_monitoring_available,connected_at,last_sync_at,connection_status,last_sync_error,last_sync_error_at,sort_order")
      .single();

    if (error) throw error;

    return NextResponse.json({ tenant: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not create tenant." },
      { status: 500 }
    );
  }
}
