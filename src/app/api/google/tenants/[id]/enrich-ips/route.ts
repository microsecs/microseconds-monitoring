import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getOrCreateDevOrganization } from "@/lib/supabaseAdmin";
import { getIpIntel, mapLimit } from "@/lib/graphSync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = getSupabaseAdmin();
    const org = await getOrCreateDevOrganization();

    const { data: tenant, error: tenantError } = await sb
      .from("google_workspace_tenants")
      .select("id,organization_id")
      .eq("id", id)
      .eq("organization_id", org.id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: tenantError?.message || "Google tenant not found." }, { status: 404 });
    }

    // Page through ALL stored Google sign-ins. This intentionally does not depend
    // on Google's incremental Reports API window.
    const uniqueIps = new Set<string>();
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await sb
        .from("signins")
        .select("ip_address")
        .eq("organization_id", tenant.organization_id)
        .eq("google_workspace_tenant_id", tenant.id)
        .not("ip_address", "is", null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      for (const row of data || []) {
        if (row.ip_address) uniqueIps.add(String(row.ip_address));
      }
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    const ips = Array.from(uniqueIps);
    const results = await mapLimit(ips, 4, async (ip) => {
      try {
        const intel = await getIpIntel(ip);
        return { ip, ok: !!intel };
      } catch (error) {
        console.error("Historical Google IP enrichment failed", ip, error);
        return { ip, ok: false };
      }
    });

    const enriched = results.filter(x => x.ok).length;
    const failed = results.filter(x => !x.ok).map(x => x.ip);

    return NextResponse.json({
      uniqueIps: ips.length,
      enriched,
      failedCount: failed.length,
      failed: failed.slice(0, 20),
    });
  } catch (error: any) {
    console.error("Google historical IP enrichment failed", error);
    return NextResponse.json({ error: error?.message || "Historical IP enrichment failed." }, { status: 500 });
  }
}
