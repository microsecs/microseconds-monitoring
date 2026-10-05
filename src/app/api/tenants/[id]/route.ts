import { NextRequest, NextResponse } from "next/server";
import { requireWritableOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const tenantName = String(body?.tenantName || "").trim();

    if (!tenantName) {
      return NextResponse.json(
        { error: "Tenant display name is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const { data, error } = await supabase
      .from("microsoft_tenants")
      .update({ tenant_name: tenantName })
      .eq("id", id)
      .eq("organization_id", org.id)
      .select("id,tenant_name")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Microsoft tenant not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, tenant: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not update tenant name." },
      { status: 500 }
    );
  }
}


export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const { data: tenant, error: tenantError } = await supabase
      .from("microsoft_tenants")
      .select("id,tenant_id,tenant_name")
      .eq("id", id)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (tenantError) throw tenantError;
    if (!tenant) {
      return NextResponse.json({ error: "Microsoft tenant not found." }, { status: 404 });
    }

    // Gather child IDs so dependent records can be removed in FK-safe order.
    const { data: signins, error: signinReadError } = await supabase
      .from("signins")
      .select("id")
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (signinReadError) throw signinReadError;

    const { data: incidents, error: incidentReadError } = await supabase
      .from("security_incidents")
      .select("id")
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (incidentReadError) throw incidentReadError;

    const signinIds = (signins || []).map((x: any) => x.id);
    const incidentIds = (incidents || []).map((x: any) => x.id);

    async function deleteIds(table: string, column: string, ids: string[]) {
      for (let i = 0; i < ids.length; i += 40) {
        const { error } = await supabase.from(table).delete().in(column, ids.slice(i, i + 40));
        if (error) throw error;
      }
    }

    // Alert log -> incidents -> findings -> sign-ins -> imports/settings -> tenant.
    await deleteIds("email_alert_log", "incident_id", incidentIds);
    await deleteIds("security_findings", "signin_id", signinIds);

    let result = await supabase
      .from("security_incidents")
      .delete()
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (result.error) throw result.error;

    result = await supabase
      .from("signins")
      .delete()
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (result.error) throw result.error;

    result = await supabase
      .from("imports")
      .delete()
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (result.error) throw result.error;

    result = await supabase
      .from("notification_settings")
      .delete()
      .eq("organization_id", org.id)
      .eq("microsoft_tenant_id", id);
    if (result.error) throw result.error;

    const { error: deleteTenantError } = await supabase
      .from("microsoft_tenants")
      .delete()
      .eq("id", id)
      .eq("organization_id", org.id);
    if (deleteTenantError) throw deleteTenantError;

    return NextResponse.json({
      ok: true,
      tenant: tenant.tenant_name || tenant.tenant_id,
      deletedSignins: signinIds.length,
      deletedIncidents: incidentIds.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not delete tenant." },
      { status: 500 }
    );
  }
}
