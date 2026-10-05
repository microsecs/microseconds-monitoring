import { NextRequest, NextResponse } from "next/server";
import { requireWritableOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const displayName = String(body?.displayName || "").trim();
    if (!displayName) return NextResponse.json({ error: "Tenant display name is required." }, { status: 400 });

    const sb = getSupabaseAdmin();
    const org = await requireWritableOrganization();
    const { data, error } = await sb
      .from("google_workspace_tenants")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", org.id)
      .select("id,display_name").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Google Workspace tenant not found." }, { status: 404 });
    return NextResponse.json({ ok: true, tenant: data });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || "Could not rename Google Workspace tenant." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const { data: tenant, error: tenantError } = await sb
      .from("google_workspace_tenants")
      .select("id,display_name,primary_domain")
      .eq("id", id).eq("organization_id", org.id).maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) return NextResponse.json({ error: "Google Workspace tenant not found." }, { status: 404 });

    const { data: signins, error: signinError } = await sb
      .from("signins").select("id")
      .eq("organization_id", org.id).eq("google_workspace_tenant_id", id);
    if (signinError) throw signinError;
    const signinIds=(signins||[]).map((x:any)=>x.id);

    for(let i=0;i<signinIds.length;i+=40){
      const ids=signinIds.slice(i,i+40);
      const findings=await sb.from("security_findings").delete().in("signin_id",ids);
      if(findings.error)throw findings.error;
    }

    const deletedSignins=await sb.from("signins").delete()
      .eq("organization_id",org.id).eq("google_workspace_tenant_id",id);
    if(deletedSignins.error)throw deletedSignins.error;

    const deletedTenant=await sb.from("google_workspace_tenants").delete()
      .eq("id",id).eq("organization_id",org.id);
    if(deletedTenant.error)throw deletedTenant.error;

    return NextResponse.json({
      ok:true,
      tenant:tenant.display_name||tenant.primary_domain||"Google Workspace",
      deletedSignins:signinIds.length
    });
  } catch(e:any){
    return NextResponse.json({error:e?.message||"Could not delete Google Workspace tenant."},{status:500});
  }
}
