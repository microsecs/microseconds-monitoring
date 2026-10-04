import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, googleLoginSample, googleDirectoryUsers, encryptGoogleSecret } from "@/lib/googleWorkspace";
import { getSupabaseAdmin, getOrCreateDevOrganization } from "@/lib/supabaseAdmin";
import { markMonitoringHealthy } from "@/lib/monitoringHealth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/tenants?googleError=${encodeURIComponent(error)}`, req.url));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/tenants?googleError=Invalid+OAuth+state", req.url));
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Reconnect and approve offline access.");

    const items = await googleLoginSample(tokens.access_token);
    const directoryUsers = await googleDirectoryUsers(tokens.access_token);
    const first = items[0] || {};
    const customerId = first?.id?.customerId || null;
    const ownerDomain = first?.ownerDomain || null;
    const actorEmail = first?.actor?.email || null;
    const emailDomain = actorEmail?.includes("@") ? actorEmail.split("@").pop() : null;
    const primaryDomain = ownerDomain || emailDomain || null;

    // A valid empty report is possible. The connection is still valid, but a domain/customer
    // may not be discoverable until an event exists.
    const org = await getOrCreateDevOrganization();
    const supabase = getSupabaseAdmin();

    const displayName = primaryDomain || "Google Workspace";
    const row = {
      organization_id: org.id,
      customer_id: customerId,
      primary_domain: primaryDomain,
      display_name: displayName,
      admin_email: actorEmail,
      refresh_token_encrypted: encryptGoogleSecret(tokens.refresh_token),
      oauth_scope: tokens.scope || null,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let query = supabase.from("google_workspace_tenants").select("id");
    if (customerId) query = query.eq("organization_id", org.id).eq("customer_id", customerId);
    else if (primaryDomain) query = query.eq("organization_id", org.id).eq("primary_domain", primaryDomain);
    else query = query.eq("organization_id", org.id).eq("admin_email", actorEmail || "");

    const existing = await query.maybeSingle();
    if (existing.error) throw existing.error;

    let googleTenantId: string;
    if (existing.data?.id) {
      const updated = await supabase
        .from("google_workspace_tenants")
        .update(row)
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (updated.error) throw updated.error;
      googleTenantId = updated.data.id;
    } else {
      const inserted = await supabase
        .from("google_workspace_tenants")
        .insert(row)
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      googleTenantId = inserted.data.id;
    }

    // A successful OAuth reconnect proves the tenant authorization is valid again.
    // Clear any stale reconnect-required/problem state immediately. A later sync still
    // performs its own health check and can set the status back if retrieval fails.
    await markMonitoringHealthy("google", googleTenantId);

    // Backfill friendly names on already-stored Google sign-ins.
    // Directory API gives us the real Workspace display name; Reports actor.profileId does not.
    let namesUpdated = 0;
    for (const user of directoryUsers) {
      if (!user.fullName) continue;
      const { data: updatedRows, error: nameError } = await supabase
        .from("signins")
        .update({ user_display_name: user.fullName })
        .eq("organization_id", org.id)
        .eq("google_workspace_tenant_id", googleTenantId)
        .ilike("user_principal_name", user.primaryEmail)
        .select("id");
      if (nameError) throw nameError;
      namesUpdated += updatedRows?.length || 0;
    }

    const response = NextResponse.redirect(
      new URL(`/tenants?googleConnected=1&googleEvents=${items.length}&googleNames=${namesUpdated}`, req.url)
    );
    response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (e: any) {
    const response = NextResponse.redirect(
      new URL(`/tenants?googleError=${encodeURIComponent(e?.message || "Google connection failed")}`, req.url)
    );
    response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  }
}
