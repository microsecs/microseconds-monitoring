import { NextResponse } from "next/server";
import { getSupabaseAdmin, getOrCreateDevOrganization, withSupabaseClockSkewRetry } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const org = await getOrCreateDevOrganization();
    const supabase = getSupabaseAdmin();
    const { data, error } = await withSupabaseClockSkewRetry(() => supabase
      .from("google_workspace_tenants")
      .select("id,display_name,primary_domain,customer_id,admin_email,last_verified_at,last_sync_at,connection_status,last_sync_error,last_sync_error_at,created_at,sort_order")
      .eq("organization_id", org.id)
      .order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }));
    if (error) throw error;
    return NextResponse.json({ tenants: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unable to load Google tenants", tenants: [] }, { status: 500 });
  }
}
